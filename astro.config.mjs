// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

/**
 * GitHub Pages に置く、確認用のプレビュー（`pnpm build:pages`）。
 * 仮データ（CMS_MODE=fixture）で静的に書き出し、/ami_HP/ の下に置く。本番の構成（SSR）とは別物。
 */
const isPagesPreview = process.env.PREVIEW_TARGET === "github-pages";

/**
 * CMS の下書きプレビューの入り口と終了（ADR-028）。サーバーで動く必要があるため、SSR のときだけ登録する。
 * GitHub Pages のプレビュー（静的書き出し）には含めない。
 */
/** @type {import("astro").AstroIntegration} */
const draftPreviewRoutes = {
  name: "ami-draft-preview-routes",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      injectRoute({ pattern: "/api/preview", entrypoint: new URL("./src/preview/enter.ts", import.meta.url), prerender: false });
      injectRoute({ pattern: "/api/preview-exit", entrypoint: new URL("./src/preview/exit.ts", import.meta.url), prerender: false });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  // canonical / OGP / sitemap の絶対URL。本番は scripts/deploy.mjs が deploy/production.json の siteHost から渡す。
  site: isPagesPreview ? "https://general-ss-system.github.io" : (process.env.SITE_URL ?? "https://www.example.com"),
  base: isPagesPreview ? "/ami_HP" : "/",

  // 本番は CMS の更新をリクエスト時に反映するため SSR にする。
  // Frontend 側で2つ目のキャッシュ層（ISR 等）は持たない（CMS docs/04 §20, ADR-022）。
  output: isPagesPreview ? "static" : "server",

  integrations: isPagesPreview ? [] : [draftPreviewRoutes],

  adapter: isPagesPreview
    ? undefined
    : cloudflare({
        // 本番は scripts/deploy.mjs が書き出した設定（案件の値入り）を使う。無ければ開発用の wrangler.jsonc。
        configPath: process.env.WRANGLER_CONFIG,
        // 手元の素材（src/assets）は事前に WebP にしたものを直接配信し（LocalImage）、
        // CMS の画像は CMS が返す URL をそのまま使う（変換は CMS 側の Cloudflare Images）。
        imageService: { build: "compile", runtime: "passthrough" },
      }),

  vite: {
    define: {
      // プレビューのときは noindex を付ける（BaseLayout）
      __PREVIEW_BUILD__: JSON.stringify(isPagesPreview),
    },
  },

  // ログインもカートも無いサイトなので、セッション（KV）は使わない。
  session: false,

  env: {
    schema: {
      // fixture: 手元の仮データで表示（CMS 無しで制作を進めるため）。live: Delivery API から取得。
      CMS_MODE: envField.enum({
        context: "server",
        access: "public",
        values: ["fixture", "live"],
        default: "fixture",
      }),
      // 例: https://cms.example.co.jp （末尾スラッシュなし）
      CMS_BASE_URL: envField.string({ context: "server", access: "public", optional: true }),
      CMS_SITE_KEY: envField.string({ context: "server", access: "public", optional: true }),
      // Delivery API の公開キー（ssdk_...）。リポジトリに置かない。
      CMS_DELIVERY_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // お問い合わせフォームのボット対策（Cloudflare Turnstile）のサイトキー。公開してよい値。
      // CMS の許可オリジンと同じホスト名で発行する（CMS docs/04 §21）。live で未設定なら送信できない。
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
});
