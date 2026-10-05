/**
 * sitemap.xml の中身。固定のページ（コードで管理）と、CMS の記事・実績の詳細ページを並べる。
 * 記事・実績を取得できなかったときは、固定のページだけで返して記録する（sitemap 全体は壊さない）。
 */

import type { CmsClient } from "./cms/client";
import { getAllTopics, getAllWorks, reportCmsError, type CmsErrorReporter } from "./cms/queries";
import { footerItems } from "../config/site";
import type { PageVisibility } from "../config/pages";
import { withBase } from "./url";

export interface SitemapEntry {
  /** サイト内のパス（ベースパスを付ける前） */
  path: string;
  /** YYYY-MM-DD */
  lastmod?: string;
}

/** 固定のページ（トップとフッターのナビ）。表示にしていない WORKS・RECRUIT・FAQ は載せない。 */
export function staticPaths(visibility: PageVisibility): string[] {
  return ["/", ...footerItems(visibility).map((item) => item.href)];
}

const DATE = /^\d{4}-\d{2}-\d{2}/;

export async function getSitemapEntries(
  client: CmsClient,
  visibility: PageVisibility,
  report: CmsErrorReporter = reportCmsError,
): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = staticPaths(visibility).map((path) => ({ path }));

  const [topics, works] = await Promise.all([
    getAllTopics(client, report).catch((err) => {
      report("failed to load ami_topics for sitemap", err);
      return [];
    }),
    // WORKS を表示していなければ、実績の詳細ページも載せない
    visibility.works
      ? getAllWorks(client, report).catch((err) => {
          report("failed to load works for sitemap", err);
          return [];
        })
      : [],
  ]);

  // 外部リンクの記事は詳細ページが無いので載せない
  for (const topic of topics) {
    if (!topic.slug || topic.externalLink) continue;
    entries.push({ path: `/topics/${encodeURIComponent(topic.slug)}`, lastmod: DATE.exec(topic.publishedDate)?.[0] });
  }
  for (const work of works) {
    if (!work.slug) continue;
    entries.push({ path: `/works/${encodeURIComponent(work.slug)}`, lastmod: work.publishedDate ? DATE.exec(work.publishedDate)?.[0] : undefined });
  }
  return entries;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * trailingSlash: 静的に書き出したサイト（/about/index.html）では、ページの URL は末尾スラッシュ付きが実体になる。
 * canonical（Astro.url）と揃え、Apache の /about → /about/ のリダイレクトを経由させないため。
 */
export function renderSitemap(entries: SitemapEntry[], site: URL, options: { trailingSlash?: boolean } = {}): string {
  const urls = entries.map((e) => {
    const path = options.trailingSlash && !e.path.endsWith("/") ? `${e.path}/` : e.path;
    const loc = new URL(withBase(path), site).toString();
    const lastmod = e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : "";
    return `  <url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}
