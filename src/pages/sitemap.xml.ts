/**
 * sitemap.xml。固定のページと、CMS の記事・実績の詳細ページ（src/lib/sitemap.ts）。
 * 下書きプレビュー中でも公開済みの内容だけを載せる（Delivery API を読む client を使う）。
 */
import type { APIRoute } from "astro";
import { getCmsClient } from "../lib/cms/env";
import { getPageVisibility } from "../lib/cms/queries";
import { getSitemapEntries, renderSitemap } from "../lib/sitemap";

export const GET: APIRoute = async ({ site }) => {
  const client = getCmsClient();
  // 表示にしていない WORKS・RECRUIT・FAQ は載せない（管理画面のページの表示設定）
  const entries = await getSitemapEntries(client, await getPageVisibility(client));
  return new Response(renderSitemap(entries, site!, { trailingSlash: __STATIC_BUILD__ }), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
