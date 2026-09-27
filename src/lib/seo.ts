/**
 * ページの <title> / description（CMS docs/04 §18: ページの値 → site_info の既定値）。
 */

import type { Media, SiteInfo } from "./cms/types";

/** site_info の title_template（例: `%s | 合同会社ami`）にページ名を差し込む。無ければページ名だけ。 */
export function pageTitle(siteInfo: SiteInfo | null, title: string): string {
  const template = siteInfo?.titleTemplate;
  return template && template.includes("%s") ? template.replace("%s", title) : title;
}

/** ページ固有の説明が無ければ site_info の既定値。どちらも無ければ出さない。 */
export function pageDescription(siteInfo: SiteInfo | null, description?: string | null): string | undefined {
  return description ?? siteInfo?.defaultDescription ?? undefined;
}

/** OGP 画像の絶対 URL。ページの画像 → site_info の既定の画像。どちらも無ければ出さない。 */
export function pageOgImage(site: URL | undefined, siteInfo: SiteInfo | null | undefined, image?: Media | null): string | undefined {
  const media = image ?? siteInfo?.defaultOgImage;
  return media ? new URL(media.url, site).toString() : undefined;
}
