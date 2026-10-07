/**
 * 表示・非表示を管理画面で切り替えるページ（CMS: サイト設定 > ページの表示設定 = ami_page_visibility / CMS ADR-035）。
 *
 * ヘッダーのナビにあるページ（ABOUT・SERVICE・MEMBER・TOPICS）とトップ・CONTACT・PRIVACY POLICY は常に表示する。
 * ここにあるページは、CMS で表示にしたときだけページを出し、フッターのナビとサイトマップに載せる。
 * 非表示のページは 404（静的書き出しでは scripts/deploy.mjs がファイルを置かない）。下書きのプレビューでは確認できる。
 */

export const OPTIONAL_PAGES = [
  { key: "works", label: "WORKS", href: "/works" },
  { key: "recruit", label: "RECRUIT", href: "/recruit" },
  { key: "faq", label: "FAQ", href: "/faq" },
] as const;

export type OptionalPageKey = (typeof OPTIONAL_PAGES)[number]["key"];

export type PageVisibility = Readonly<Record<OptionalPageKey, boolean>>;

/** CMS に設定が無い・読めないときは非表示（要件に入っていないページを誤って出さない）。 */
export const DEFAULT_PAGE_VISIBILITY: PageVisibility = { works: false, recruit: false, faq: false };
