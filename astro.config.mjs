// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  // 本番ドメインが決まったら差し替える（canonical / OGP の絶対URLに使う）。
  site: "https://www.example.com",

  // CMS の更新をリクエスト時に反映するため SSR にする。
  // Frontend 側で2つ目のキャッシュ層（ISR 等）は持たない（CMS docs/04 §20, ADR-022）。
  output: "server",

  adapter: cloudflare({
    // 手元の素材（src/assets）はビルド時に最適化し、
    // CMS の画像は CMS が返す URL をそのまま使う（変換は CMS 側の Cloudflare Images）。
    imageService: { build: "compile", runtime: "passthrough" },
  }),

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
