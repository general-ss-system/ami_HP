// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

/**
 * ビルドの種類（CMS docs/05 ADR-031）。
 * - server（既定）… 開発（pnpm dev）と SSR。
 * - github-pages … 確認用のプレビュー（`pnpm build:pages`）。仮データで静的に書き出し、/ami_HP/ の下に置く。検索に載せない。
 * - xserver … 本番。ビルドの時点で CMS から読み、静的な HTML として Xserver に置く（`pnpm release build`）。
 * - preview-worker … 下書きプレビュー専用の SSR（workers.dev）。検索に載せない（`pnpm release preview-deploy`）。
 */
const target = process.env.BUILD_TARGET ?? (process.env.PREVIEW_TARGET === "github-pages" ? "github-pages" : "server");
if (!["server", "github-pages", "xserver", "preview-worker"].includes(target)) throw new Error(`BUILD_TARGET が不正です: ${target}`);
const isPagesPreview = target === "github-pages";
const isStatic = isPagesPreview || target === "xserver";
const noindex = isPagesPreview || target === "preview-worker";

/**
 * CMS の下書きプレビューの入り口と終了（ADR-028）と、CMS の Webhook の受け口（ADR-031）。
 * サーバーで動く必要があるため、SSR のときだけ登録する。静的書き出し（GitHub Pages・Xserver）には含めない。
 */
/** @type {import("astro").AstroIntegration} */
const draftPreviewRoutes = {
  name: "ami-draft-preview-routes",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      injectRoute({ pattern: "/api/preview", entrypoint: new URL("./src/preview/enter.ts", import.meta.url), prerender: false });
      injectRoute({ pattern: "/api/preview-exit", entrypoint: new URL("./src/preview/exit.ts", import.meta.url), prerender: false });
      injectRoute({ pattern: "/api/cms-webhook", entrypoint: new URL("./src/preview/cms-webhook.ts", import.meta.url), prerender: false });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  // canonical / OGP / sitemap の絶対URL。本番は scripts/deploy.mjs が deploy/production.json から渡す。
  site: isPagesPreview ? "https://general-ss-system.github.io" : (process.env.SITE_URL ?? "https://www.example.com"),
  base: isPagesPreview ? "/ami_HP" : "/",

  // 本番（Xserver）は CMS の公開のたびに静的に書き出し直す（ADR-031）。下書きプレビューは SSR。
  // Frontend 側で2つ目のキャッシュ層（ISR 等）は持たない（CMS docs/04 §20, ADR-022）。
  output: isStatic ? "static" : "server",

  integrations: isStatic ? [] : [draftPreviewRoutes],

  adapter: isStatic
    ? undefined
    : cloudflare({
        // 下書きプレビューは scripts/deploy.mjs が書き出した設定（案件の値入り）を使う。無ければ開発用の wrangler.jsonc。
        configPath: process.env.WRANGLER_CONFIG,
        // 手元の素材（src/assets）は事前に WebP にしたものを直接配信し（LocalImage）、
        // CMS の画像は CMS が返す URL をそのまま使う（変換は CMS 側の Cloudflare Images）。
        imageService: { build: "compile", runtime: "passthrough" },
      }),

  vite: {
    define: {
      // 本番以外の公開物には noindex を付け、robots.txt で拒否する（BaseLayout / robots.txt.ts）
      __PREVIEW_BUILD__: JSON.stringify(noindex),
      __STATIC_BUILD__: JSON.stringify(isStatic),
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
      // CMS の Webhook を受けて再ビルドを起動する（下書きプレビュー用の Worker だけ / ADR-031）。
      // GITHUB_REPO は wrangler の vars（deploy/production.json から）、残りの2つは wrangler secret put で渡す。
      GITHUB_REPO: envField.string({ context: "server", access: "public", optional: true }),
      CMS_WEBHOOK_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      GITHUB_DISPATCH_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
