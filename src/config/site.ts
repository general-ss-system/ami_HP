/**
 * サイト構造の設定（コードで管理する部分）。
 *
 * ナビの項目・順番はレイアウトの一部なので CMS にしない。
 * 並び順はヘッダーのデザインに合わせる（フッターも同じ順番）。
 */

import { OPTIONAL_PAGES, type PageVisibility } from "./pages";

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "ABOUT", href: "/about" },
  { label: "SERVICE", href: "/service" },
  { label: "MEMBER", href: "/member" },
  { label: "TOPICS", href: "/topics" },
];

/** site_info を取得できないときだけ使うサイト名（ロゴの読み上げと同じ）。 */
export const SITE_NAME = "合同会社ami";

export const CONTACT_HREF = "/contact";
export const PRIVACY_HREF = "/privacy";

/**
 * フッターのナビ。ヘッダー（デザインの 4 項目）に、デザインに無い下層ページを足したもの。
 * WORKS・RECRUIT・FAQ は、管理画面のページの表示設定で表示にしているときだけ載せる（config/pages.ts）。
 * ヘッダーのページ・CONTACT・PRIVACY POLICY は常に載せる。
 */
export function footerItems(visibility: PageVisibility): NavItem[] {
  return [
    ...NAV_ITEMS,
    ...OPTIONAL_PAGES.filter((p) => visibility[p.key]).map((p) => ({ label: p.label, href: p.href })),
    { label: "CONTACT", href: CONTACT_HREF },
    { label: "PRIVACY POLICY", href: PRIVACY_HREF },
  ];
}
