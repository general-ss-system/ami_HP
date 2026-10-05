/**
 * 表示にしていないページ（管理画面のページの表示設定 / config/pages.ts）への応答。
 *
 * - SSR（下書きプレビュー用 Worker・開発）… 404 ページ
 * - 静的書き出し … 目印だけの HTML（デプロイのときに取り除く / lib/deploy/hidden-pages.ts）
 * 下書きのプレビュー中は、表示する前に内容を確かめられるよう、呼び出し側でこの応答を使わない。
 */
import { hiddenPageHtml } from "./deploy/hidden-pages";

export function respondHiddenPage(rewrite: (path: string) => Promise<Response>): Response | Promise<Response> {
  if (__STATIC_BUILD__) return new Response(hiddenPageHtml(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  return rewrite("/404");
}
