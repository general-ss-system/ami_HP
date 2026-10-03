/** 検索に載せないビルド（GitHub Pages・下書きプレビュー用 Worker）のとき true（astro.config.mjs の vite.define）。 */
declare const __PREVIEW_BUILD__: boolean;
/** 静的に書き出すビルド（GitHub Pages のプレビュー・Xserver の本番）のとき true（astro.config.mjs の vite.define）。 */
declare const __STATIC_BUILD__: boolean;

declare namespace App {
  interface Locals {
    /** 下書きプレビュー中のトークン（src/middleware.ts が Cookie から入れる）。通常は null。 */
    previewToken: string | null;
  }
}
