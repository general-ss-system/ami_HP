/**
 * サイト構造の設定（コードで管理する部分）。
 *
 * ナビの項目・順番はレイアウトの一部なので CMS にしない。
 * 並び順はヘッダーのデザインに合わせる（フッターも同じ順番）。
 */

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "ABOUT", href: "/about" },
  { label: "SERVICE", href: "/service" },
  { label: "MEMBER", href: "/#member" },
  { label: "TOPICS", href: "/#topics" },
];

export const CONTACT_HREF = "/contact";
