import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DISPATCH_EVENT_TYPE, dispatchRebuild, needsRebuild, verifySignature } from "./webhook-relay";

const secret = "whsec_test";
const body = JSON.stringify({ id: "evt_1", type: "content.published" });
const now = 1_790_000_000;

// CMS（apps/backend/src/infrastructure/webhook/sender.ts）と同じ作り方
function sign(t: number, payload = body, key = secret): string {
  return `t=${t},v1=${createHmac("sha256", key).update(`${t}.${payload}`).digest("hex")}`;
}

describe("verifySignature", () => {
  it("CMS の署名を受け付ける", async () => {
    expect(await verifySignature(secret, sign(now), body, now)).toBe(true);
  });

  it("本文・鍵が違う署名、形の崩れた署名、署名なしを拒む", async () => {
    expect(await verifySignature(secret, sign(now, `${body} `), body, now)).toBe(false);
    expect(await verifySignature(secret, sign(now, body, "whsec_other"), body, now)).toBe(false);
    expect(await verifySignature(secret, "t=abc,v1=zz", body, now)).toBe(false);
    expect(await verifySignature(secret, null, body, now)).toBe(false);
  });

  it("5分より古い（または先の）署名を拒む（使い回しを防ぐ）", async () => {
    expect(await verifySignature(secret, sign(now - 301), body, now)).toBe(false);
    expect(await verifySignature(secret, sign(now + 301), body, now)).toBe(false);
    expect(await verifySignature(secret, sign(now - 299), body, now)).toBe(true);
  });
});

describe("needsRebuild", () => {
  it("公開サイトの内容が変わるイベントだけ再ビルドする", () => {
    expect(needsRebuild("content.published")).toBe(true);
    expect(needsRebuild("content.unpublished")).toBe(true);
    expect(needsRebuild("content.archived")).toBe(true);
    expect(needsRebuild("content.deleted")).toBe(true);
    expect(needsRebuild("content.scheduled")).toBe(false);
    expect(needsRebuild("form.submitted")).toBe(false);
    expect(needsRebuild(null)).toBe(false);
  });
});

describe("dispatchRebuild", () => {
  it("GitHub の repository_dispatch を呼ぶ", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    await dispatchRebuild({ repo: "org/ami_HP", token: "ghp_x", eventId: "evt_1", eventType: "content.published" }, fetchFn);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/org/ami_HP/dispatches");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ghp_x");
    expect(JSON.parse(String(init.body))).toEqual({
      event_type: DISPATCH_EVENT_TYPE,
      client_payload: { eventId: "evt_1", eventType: "content.published" },
    });
  });

  it("204 以外は失敗にする（CMS が再送する）", async () => {
    const fetchFn = vi.fn(async () => new Response("bad", { status: 401 }));
    await expect(dispatchRebuild({ repo: "org/ami_HP", token: "x", eventId: "e", eventType: "content.published" }, fetchFn)).rejects.toThrow("401");
  });
});
