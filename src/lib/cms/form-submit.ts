/**
 * お問い合わせフォームの送信（Form API / CMS docs/02 §10, docs/04 §21）。ブラウザで動く。
 *
 * - 送信先は CMS の Form API を**ブラウザから直接**呼ぶ。CMS は送信者の IP でレート制限と
 *   Turnstile の検証を行うため、サイトのサーバーを経由させない（経由すると全員が同じ IP になる）。
 * - 入力チェックは使いやすさのため。正しさの判定は CMS 側が行う。
 * - 応答の形は contracts.ts の ErrorResponse。ブラウザに zod を持ち込まないよう、ここでは手で読む。
 */

import type { FormField } from "./types";

export type FormValues = Record<string, string>;

export interface SubmissionPayload {
  fields: FormValues;
  consent?: boolean;
  consentTextVersion?: string;
  turnstileToken: string;
}

export type SubmitResult =
  | { ok: true }
  | {
      ok: false;
      kind: "validation";
      message: string;
      /** 項目の key → 指摘。 */
      fieldErrors: Record<string, string>;
      /** 同意の指摘（同意なし・同意文の版が古い）。 */
      consentError: string | null;
      /** ボット対策の確認に失敗した（ウィジェットをやり直させる）。 */
      turnstileError: string | null;
    }
  | { ok: false; kind: "rate_limited"; message: string; retryAfterSeconds: number | null }
  | { ok: false; kind: "unavailable" | "server" | "network"; message: string };

const MESSAGE_NETWORK = "通信できませんでした。電波の良いところで、もう一度お試しください。";
const MESSAGE_SERVER = "送信できませんでした。時間をおいてもう一度お試しください。";
const MESSAGE_UNAVAILABLE = "現在お問い合わせを受け付けていません。時間をおいてもう一度お試しください。";
const MESSAGE_RATE_LIMITED = "短時間に送信が集中しています。時間をおいてもう一度お試しください。";

interface ErrorBody {
  code?: string;
  message?: string;
  details?: { field: string; reason: string }[];
}

function readError(body: unknown): ErrorBody {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error !== "object" || error === null) return {};
  const e = error as Record<string, unknown>;
  const details = Array.isArray(e.details)
    ? e.details.filter(
        (d): d is { field: string; reason: string } =>
          typeof d === "object" && d !== null && typeof d.field === "string" && typeof d.reason === "string",
      )
    : undefined;
  return {
    code: typeof e.code === "string" ? e.code : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
    details,
  };
}

export async function submitForm(
  endpoint: string,
  payload: SubmissionPayload,
  doFetch: typeof fetch = fetch,
): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await doFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
    });
  } catch {
    return { ok: false, kind: "network", message: MESSAGE_NETWORK };
  }

  if (res.ok) return { ok: true };

  const error = readError(await res.json().catch(() => null));

  if (res.status === 400) {
    const fieldErrors: Record<string, string> = {};
    let consentError: string | null = null;
    let turnstileError: string | null = null;
    for (const d of error.details ?? []) {
      // "fields.name" の形で返っても受けられるようにする
      const key = d.field.replace(/^fields\./, "");
      if (key === "consent" || key === "consentTextVersion") consentError ??= d.reason;
      else if (key === "turnstileToken") turnstileError ??= d.reason;
      else fieldErrors[key] ??= d.reason;
    }
    return {
      ok: false,
      kind: "validation",
      message: error.message ?? "入力内容を確認してください。",
      fieldErrors,
      consentError,
      turnstileError,
    };
  }

  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After"));
    return {
      ok: false,
      kind: "rate_limited",
      message: error.message ?? MESSAGE_RATE_LIMITED,
      retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : null,
    };
  }

  // 403: 受付停止中・許可されていないオリジン / 404: フォームが無い
  if (res.status === 403 || res.status === 404) {
    return { ok: false, kind: "unavailable", message: error.message ?? MESSAGE_UNAVAILABLE };
  }

  return { ok: false, kind: "server", message: MESSAGE_SERVER };
}

// ---------------------------------------------------------------------------
// 入力チェック（使いやすさのため。CMS の検証と同じ観点の一部）
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 前後の空白を除く。複数行の欄は改行コードを \n にそろえる。 */
export function normalizeValue(field: FormField, raw: string): string {
  const value = field.type === "textarea" ? raw.replace(/\r\n?/g, "\n") : raw.replace(/[\r\n]+/g, " ");
  return value.trim();
}

/** 1 項目の指摘。問題が無ければ null。 */
export function checkValue(field: FormField, value: string): string | null {
  if (value === "") return field.required ? "入力してください" : null;
  const length = [...value].length;
  if (field.maxLength !== null && length > field.maxLength) return `${field.maxLength}文字以内で入力してください`;
  if (field.type === "email" && !EMAIL_PATTERN.test(value)) return "メールアドレスの形式が正しくありません";
  if (field.type === "url" && !/^https?:\/\/\S+$/i.test(value)) return "http または https のURLを入力してください";
  if (field.type === "select" && field.options && !field.options.some((o) => o.value === value)) {
    return "選択肢から選んでください";
  }
  return null;
}

export function checkValues(fields: FormField[], values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const error = checkValue(field, values[field.key] ?? "");
    if (error) errors[field.key] = error;
  }
  return errors;
}

/** 送信する fields。空の任意項目は送らない。 */
export function toSubmissionFields(fields: FormField[], values: FormValues): FormValues {
  const out: FormValues = {};
  for (const field of fields) {
    const value = values[field.key] ?? "";
    if (value !== "") out[field.key] = value;
  }
  return out;
}
