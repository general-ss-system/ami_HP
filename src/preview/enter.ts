/**
 * 下書きプレビューの入り口（ADR-028）。astro.config.mjs で /api/preview に登録する（SSR のときだけ）。
 *
 *   GET /api/preview?token={token}&model={model}&slug={slug}&entryId={entryId}
 *
 * CMS のサイト設定「プレビュー用URL」にこの形で登録する（{token} と {model} は必須）。
 * トークンが有効なことを Preview API で確かめてから httpOnly Cookie に移し、該当ページへ送る。
 * 無効なトークンで Cookie を配ると、以降のページが毎回 401 になって原因が分かりにくいため。
 */

import type { APIRoute } from "astro";
import { getPreviewClient } from "../lib/cms/env";
import { PreviewTokenError } from "../lib/cms/client";
import { PREVIEW_COOKIE, PREVIEW_HEADERS, loadPreviewEntry, previewCookieOptions, previewTargetSlug, resolvePreviewPath } from "../lib/cms/preview";

export const prerender = false;

function message(status: number, text: string): Response {
  return new Response(text, { status, headers: { ...PREVIEW_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const token = url.searchParams.get("token")?.trim();
  const model = url.searchParams.get("model")?.trim();
  const slug = url.searchParams.get("slug")?.trim() || null;
  const entryId = url.searchParams.get("entryId")?.trim() || null;

  if (!token || !model) {
    return message(400, "プレビューの URL が正しくありません。管理画面からもう一度プレビューを開いてください。");
  }

  const client = getPreviewClient(token);
  if (!client) {
    return message(503, "このサイトは CMS につながっていないため（CMS_MODE=fixture）、プレビューできません。");
  }

  try {
    const entry = await loadPreviewEntry(client, { model, slug, entryId });
    if (!entry) return message(404, "プレビューする内容が見つかりませんでした。");

    const path = resolvePreviewPath(model, previewTargetSlug(model, entry));
    if (!path) return message(404, `この内容を表示するページがサイトにありません（${model}）。`);

    cookies.set(PREVIEW_COOKIE, token, previewCookieOptions(url.protocol === "https:"));
    return new Response(null, { status: 302, headers: { ...PREVIEW_HEADERS, Location: path } });
  } catch (err) {
    if (err instanceof PreviewTokenError) {
      return message(401, "プレビューの有効期限が切れています。管理画面からもう一度プレビューを開いてください。");
    }
    throw err;
  }
};
