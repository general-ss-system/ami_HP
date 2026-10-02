/**
 * CMS の Webhook の受け口（ADR-031）。astro.config.mjs で /api/cms-webhook に登録する（下書きプレビュー用の Worker だけ）。
 *
 * CMS の管理画面（Webhook）に、送信先 https://<preview.host>/api/cms-webhook と
 * イベント（公開・非公開・アーカイブ・削除）を登録し、表示された署名鍵を Worker の Secret CMS_WEBHOOK_SECRET に入れる。
 * 処理は src/lib/deploy/webhook-relay.ts。
 */

import type { APIRoute } from "astro";
import { CMS_WEBHOOK_SECRET, GITHUB_DISPATCH_TOKEN, GITHUB_REPO } from "astro:env/server";
import { MAX_BODY_BYTES, dispatchRebuild, needsRebuild, verifySignature } from "../lib/deploy/webhook-relay";

export const prerender = false;

function reply(status: number, text: string): Response {
  return new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export const POST: APIRoute = async ({ request }) => {
  if (!CMS_WEBHOOK_SECRET || !GITHUB_DISPATCH_TOKEN || !GITHUB_REPO) {
    // 設定漏れ。5xx にして CMS の「配送状況」に失敗として残す（再送もされる）。
    console.error("cms-webhook: CMS_WEBHOOK_SECRET / GITHUB_DISPATCH_TOKEN / GITHUB_REPO が設定されていません");
    return reply(503, "not configured");
  }

  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (length > MAX_BODY_BYTES) return reply(413, "too large");
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return reply(413, "too large");

  if (!(await verifySignature(CMS_WEBHOOK_SECRET, request.headers.get("X-SS-Signature"), body))) {
    return reply(401, "invalid signature");
  }

  const eventType = request.headers.get("X-SS-Event-Type");
  // 再ビルドの要らないイベントも 2xx で受け取る（CMS が失敗として再送し続けないように）。
  if (!needsRebuild(eventType)) return reply(202, "ignored");

  try {
    await dispatchRebuild({ repo: GITHUB_REPO, token: GITHUB_DISPATCH_TOKEN, eventId: request.headers.get("X-SS-Event-Id") ?? "", eventType: eventType! });
  } catch (error) {
    console.error("cms-webhook: 再ビルドを起動できませんでした", error instanceof Error ? error.message : "unknown");
    return reply(502, "dispatch failed");
  }
  return reply(202, "rebuild requested");
};
