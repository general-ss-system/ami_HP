import { describe, expect, it, vi } from "vitest";
import { checkValue, checkValues, normalizeValue, submitForm, toSubmissionFields } from "./form-submit";
import type { FormField } from "./types";

const field = (over: Partial<FormField>): FormField => ({
  key: "name",
  label: "お名前",
  type: "text",
  required: true,
  helpText: null,
  options: null,
  maxLength: null,
  ...over,
});

const fields = [
  field({ key: "name", maxLength: 5 }),
  field({ key: "company", required: false }),
  field({ key: "email", type: "email" }),
  field({ key: "message", type: "textarea" }),
];

const payload = { fields: { name: "a" }, consent: true, consentTextVersion: "v1", turnstileToken: "t" };

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers }));
}

const errorBody = (message: string, details: { field: string; reason: string }[] = []) => ({
  error: { code: "VALIDATION_ERROR", message, requestId: "req_1", details },
});

describe("submitForm", () => {
  it("201 なら成功。本文は JSON で、Cookie を送らない", async () => {
    const doFetch = respond(201, { status: "accepted" });
    expect(await submitForm("https://cms.example/api", payload, doFetch)).toEqual({ ok: true });
    const [, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("400 の指摘を、項目・同意・ボット対策に振り分ける", async () => {
    const doFetch = respond(
      400,
      errorBody("入力内容を確認してください。", [
        { field: "email", reason: "メールアドレスの形式が正しくありません" },
        { field: "fields.name", reason: "必須です" },
        { field: "consent", reason: "同意文が更新されました。ページを再読み込みしてから送信してください" },
        { field: "turnstileToken", reason: "ボット対策の確認に失敗しました" },
      ]),
    );
    expect(await submitForm("x", payload, doFetch)).toEqual({
      ok: false,
      kind: "validation",
      message: "入力内容を確認してください。",
      fieldErrors: { email: "メールアドレスの形式が正しくありません", name: "必須です" },
      consentError: "同意文が更新されました。ページを再読み込みしてから送信してください",
      turnstileError: "ボット対策の確認に失敗しました",
    });
  });

  it("429 は Retry-After を読む", async () => {
    const doFetch = respond(429, errorBody("短時間に送信が集中しています。"), { "Retry-After": "120" });
    expect(await submitForm("x", payload, doFetch)).toMatchObject({ kind: "rate_limited", retryAfterSeconds: 120 });
  });

  it("403 / 404 は受付できない、5xx はサーバーの失敗、通信の失敗は network", async () => {
    expect(await submitForm("x", payload, respond(403, errorBody("現在このフォームでは受け付けを停止しています。")))).toMatchObject({
      kind: "unavailable",
      message: "現在このフォームでは受け付けを停止しています。",
    });
    expect(await submitForm("x", payload, respond(500, { nope: true }))).toMatchObject({ kind: "server" });
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await submitForm("x", payload, failing)).toMatchObject({ kind: "network" });
  });
});

describe("入力チェック", () => {
  it("必須・文字数（見た目の文字数）・メールの形式", () => {
    expect(checkValues(fields, { name: "", email: "a@b", message: "x" })).toEqual({
      name: "入力してください",
      email: "メールアドレスの形式が正しくありません",
    });
    expect(checkValue(fields[0]!, "👍👍👍👍👍")).toBeNull();
    expect(checkValue(fields[0]!, "あいうえおか")).toBe("5文字以内で入力してください");
    expect(checkValue(fields[1]!, "")).toBeNull();
  });

  it("前後の空白を除き、1 行の欄の改行は空白にする", () => {
    expect(normalizeValue(fields[0]!, "  山田\n太郎 ")).toBe("山田 太郎");
    expect(normalizeValue(fields[3]!, " 1行目\r\n2行目 ")).toBe("1行目\n2行目");
  });

  it("空の任意項目は送らない", () => {
    expect(toSubmissionFields(fields, { name: "a", company: "", email: "a@b.co", message: "m" })).toEqual({
      name: "a",
      email: "a@b.co",
      message: "m",
    });
  });
});
