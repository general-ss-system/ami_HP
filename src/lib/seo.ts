/**
 * ページの <title> / description（CMS docs/04 §18: ページの値 → site_info の既定値）。
 */

import type { SiteInfo } from "./cms/types";

/** site_info の title_template（例: `%s | 合同会社ami`）にページ名を差し込む。無ければページ名だけ。 */
export function pageTitle(siteInfo: SiteInfo | null, title: string): string {
  const template = siteInfo?.titleTemplate;
  return template && template.includes("%s") ? template.replace("%s", title) : title;
}

/** ページ固有の説明が無ければ site_info の既定値。どちらも無ければ出さない。 */
export function pageDescription(siteInfo: SiteInfo | null, description?: string | null): string | undefined {
  return description ?? siteInfo?.defaultDescription ?? undefined;
}
