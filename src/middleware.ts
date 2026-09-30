/**
 * 下書きプレビュー中かどうかを 1 か所で判定する（ADR-028 / CMS docs/04 §19）。
 *
 * - Cookie のトークンを locals.previewToken に入れる（ページは getCmsClient(Astro.locals) で下書きを読む）。
 * - プレビュー中の応答は、ページの実装によらず private, no-store・noindex にする。
 * - トークンの期限切れ（Preview API が 401）は Cookie を消し、管理画面から開き直すよう案内する。
 * 静的書き出し（GitHub Pages のプレビュー）では何もしない。
 */

import { defineMiddleware, sequence } from "astro:middleware";
import { PreviewTokenError } from "./lib/cms/client";
import { PREVIEW_COOKIE, PREVIEW_HEADERS, previewCookieOptions } from "./lib/cms/preview";
import { addPhraseBreaks } from "./lib/phrases";

const EXPIRED_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>プレビューの有効期限が切れました</title>
<style>
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
    font-family: "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif; line-height: 2;
    color: #1b1c22; background: #041049; }
  main { max-width: 520px; padding: 40px 32px; background: #f6f6f6; border: 2px solid #1b1c22;
    box-shadow: 8px 8px 0 rgb(0 192 232 / 0.6); }
  h1 { margin: 0 0 16px; font-size: 20px; font-weight: 400; }
  p { margin: 0; font-size: 15px; }
</style>
</head>
<body>
<main>
  <h1>プレビューの有効期限が切れました</h1>
  <p>下書きのプレビューは 1 時間で使えなくなります。<br>CMS の管理画面から、もう一度「プレビュー」を開いてください。</p>
</main>
</body>
</html>`;

const preview = defineMiddleware(async (context, next) => {
  context.locals.previewToken = null;
  if (context.isPrerendered) return next();

  const token = context.cookies.get(PREVIEW_COOKIE)?.value?.trim();
  context.locals.previewToken = token ? token : null;

  let response: Response;
  try {
    response = await next();
  } catch (err) {
    if (!(err instanceof PreviewTokenError)) throw err;
    context.cookies.delete(PREVIEW_COOKIE, { path: previewCookieOptions(false).path });
    return new Response(EXPIRED_HTML, {
      status: 401,
      headers: { ...PREVIEW_HEADERS, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (context.locals.previewToken !== null) {
    for (const [name, value] of Object.entries(PREVIEW_HEADERS)) response.headers.set(name, value);
  }
  return response;
});

/**
 * 日本語の文を文節の区切りでだけ改行させる（Google の BudouX / src/lib/phrases.ts）。
 * CMS の文章も含めて、出来上がった HTML の本文にまとめて区切りを入れる。静的書き出しにも効く。
 */
const phraseBreaks = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (!response.headers.get("Content-Type")?.startsWith("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return new Response(addPhraseBreaks(await response.text()), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

export const onRequest = sequence(phraseBreaks, preview);
