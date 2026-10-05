/**
 * 表示にしていないページ（管理画面のページの表示設定 / config/pages.ts）の静的書き出しの扱い。
 *
 * 静的書き出しでは、ページを出すかどうかがビルドの途中（CMS を読んだ後）に決まる。
 * 非表示のページは本文の代わりにこの目印だけを書き出し、scripts/deploy.mjs・build-pages.mjs が目印のあるファイルを置かない。
 * scripts/deploy.mjs から Node で直接読み込むため、このファイルは他のモジュールを import しない。
 */

const MARKER_NAME = "ami-hidden-page";

/** 非表示のページの代わりに書き出す HTML。 */
export function hiddenPageHtml(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="${MARKER_NAME}" content="1"><meta name="robots" content="noindex"></head><body></body></html>`;
}

export function isHiddenPageHtml(html: string): boolean {
  return html.includes(`name="${MARKER_NAME}"`);
}
