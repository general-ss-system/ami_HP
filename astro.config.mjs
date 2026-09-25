// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

/**
 * GitHub Pages に置く、確認用のプレビュー（`pnpm build:pages`）。
 * 仮データ（CMS_MODE=fixture）で静的に書き出し、/ami_HP/ の下に置く。本番の構成（SSR）とは別物。
 */
const isPagesPreview = process.env.PREVIEW_TARGET === "github-pages";

// https://astro.build/config
export default defineConfig({
  // 本番ドメインが決まったら差し替える（canonical / OGP の絶対URLに使う）。
  site: isPagesPreview ? "https://general-ss-system.github.io" : "https://www.example.com",
  base: isPagesPreview ? "/ami_HP" : "/",

  // 本番は CMS の更新をリクエスト時に反映するため SSR にする。
  // Frontend 側で2つ目のキャッシュ層（ISR 等）は持たない（CMS docs/04 §20, ADR-022）。
  output: isPagesPreview ? "static" : "server",

  adapter: isPagesPreview
    ? undefined
    : cloudflare({
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
    },
  },
});
