/**
 * robots.txt。本番は sitemap.xml の場所を知らせる。GitHub Pages のプレビューは検索に載せない。
 */
import type { APIRoute } from "astro";
import { withBase } from "../lib/url";

export const GET: APIRoute = ({ site }) => {
  const body = __PREVIEW_BUILD__
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL(withBase("/sitemap.xml"), site)}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
