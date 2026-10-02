/**
 * CMS の Webhook を受けて、公開サイトの再ビルド（GitHub Actions）を起動する（CMS docs/05 ADR-031）。
 *
 * 公開サイトは Xserver に置く静的な HTML なので、CMS で公開・非公開にした内容はビルドし直すまで反映されない。
 * CMS は GitHub を直接呼べない（GitHub の API は CMS の署名を知らない）ため、下書きプレビュー用の Worker が間に入る。
 *
 *   CMS ──(X-SS-Signature 付き POST)──▶ /api/cms-webhook ──(repository_dispatch)──▶ GitHub Actions
 *
 * 署名の形式は CMS の apps/backend/src/infrastructure/webhook/sender.ts:
 *   X-SS-Signature: t=<unix秒>,v1=<hex(HMAC-SHA256(secret, "<t>.<本文>"))>
 * 配送は at-least-once。重複して届いても、Actions の concurrency で待ちは1件にまとまる。
 */

/** 再ビルドが要るイベント。公開サイトに出る内容が変わるものだけ（予約・フォーム受信では変わらない）。 */
export const REBUILD_EVENTS = ["content.published", "content.unpublished", "content.archived", "content.deleted"] as const;

/** 署名の時刻の許容幅。古い署名の使い回し（リプレイ）を防ぐ。 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/** 受け付ける本文の上限。CMS の Webhook の本文は数百バイト。 */
export const MAX_BODY_BYTES = 64 * 1024;

/** GitHub の repository_dispatch の event_type。.github/workflows/deploy.yml の types と揃える。 */
export const DISPATCH_EVENT_TYPE = "cms-publish";

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 長さが同じ文字列を、内容によらず同じ時間で比べる（署名の推測を防ぐ）。 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** CMS の署名を確かめる。nowSeconds はテストのために渡せる。 */
export async function verifySignature(
  secret: string,
  header: string | null,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header) return false;
  const parts = new Map(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
    }),
  );
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !/^\d{1,12}$/.test(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(nowSeconds - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) return false;
  return timingSafeEqual(await hmacSha256Hex(secret, `${t}.${body}`), v1);
}

export function needsRebuild(eventType: string | null): boolean {
  return (REBUILD_EVENTS as readonly string[]).includes(eventType ?? "");
}

export interface DispatchRequest {
  readonly repo: string;
  readonly token: string;
  readonly eventId: string;
  readonly eventType: string;
}

/** GitHub に再ビルドを頼む。成功（204）以外は例外にして、CMS 側の再送に任せる。 */
export async function dispatchRebuild(req: DispatchRequest, fetchFn: typeof fetch = fetch): Promise<void> {
  const res = await fetchFn(`https://api.github.com/repos/${req.repo}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${req.token}`,
      "Content-Type": "application/json",
      "User-Agent": "ami-hp-cms-webhook",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ event_type: DISPATCH_EVENT_TYPE, client_payload: { eventId: req.eventId, eventType: req.eventType } }),
  });
  // 応答本文は読まない（ログに GitHub の応答を残さない）。
  await res.body?.cancel();
  if (res.status !== 204) throw new Error(`GitHub が ${res.status} を返しました`);
}
