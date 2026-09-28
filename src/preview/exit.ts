/**
 * 下書きプレビューの終了。Cookie を消して通常の表示に戻す。astro.config.mjs で /api/preview-exit に登録する。
 *
 *   GET /api/preview-exit?to=/topics/sample
 */

import type { APIRoute } from "astro";
import { PREVIEW_COOKIE, PREVIEW_HEADERS, previewCookieOptions, safeReturnPath } from "../lib/cms/preview";

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  cookies.delete(PREVIEW_COOKIE, { path: previewCookieOptions(false).path });
  return new Response(null, {
    status: 302,
    headers: { ...PREVIEW_HEADERS, Location: safeReturnPath(url.searchParams.get("to")) },
  });
};
