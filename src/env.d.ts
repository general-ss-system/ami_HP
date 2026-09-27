/** GitHub Pages のプレビュー用ビルドのとき true（astro.config.mjs の vite.define）。 */
declare const __PREVIEW_BUILD__: boolean;

declare namespace App {
  interface Locals {
    /** 下書きプレビュー中のトークン（src/middleware.ts が Cookie から入れる）。通常は null。 */
    previewToken: string | null;
  }
}
