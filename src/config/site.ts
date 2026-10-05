/**
 * サイト構造の設定（コードで管理する部分）。
 *
 * ナビの項目・順番はレイアウトの一部なので CMS にしない。
 * 並び順はヘッダーのデザインに合わせる（フッターも同じ順番）。
 */

import { OPTIONAL_SECTIONS } from "./sections";

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
 * WORKS・RECRUIT・FAQ は src/config/sections.ts で公開しているときだけ出す。
 */
export const FOOTER_ITEMS: readonly NavItem[] = [
  ...NAV_ITEMS,
  ...(OPTIONAL_SECTIONS.works ? [{ label: "WORKS", href: "/works" }] : []),
  ...(OPTIONAL_SECTIONS.recruit ? [{ label: "RECRUIT", href: "/recruit" }] : []),
  ...(OPTIONAL_SECTIONS.faq ? [{ label: "FAQ", href: "/faq" }] : []),
  { label: "CONTACT", href: CONTACT_HREF },
  { label: "PRIVACY POLICY", href: PRIVACY_HREF },
];
