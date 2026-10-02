#!/usr/bin/env node
/**
 * 公開サイトを本番（Cloudflare Workers）へ出す。
 *
 *   pnpm release <コマンド> [--config deploy/production.json] [--yes]
 *
 *   check    本番設定を検証し、公開用の wrangler 設定（wrangler.production.json）を書き出す（Cloudflare には触れない）
 *   build    check のうえで、本番の値（CMS の接続先・本番ドメイン・Turnstile）でビルドする
 *   deploy   build のうえでデプロイする。--yes を付けたときだけ実行する（付けなければ内容の表示だけ）
 *
 * CMS の公開キー（CMS_DELIVERY_KEY）は設定ファイルに書かない。初回のデプロイ後に一度だけ登録する:
 *   pnpm exec wrangler secret put CMS_DELIVERY_KEY --name <workerName>
 *
 * 認証は `wrangler login` か、環境変数 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID。
 * 本番の値の置き場所と手順は docs/deploy.md。
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderWranglerConfig, stripJsonc, validateProductionConfig } from "../src/lib/deploy/production-config.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GENERATED_CONFIG = "wrangler.production.json";

function option(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, env = {}) {
  const res = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } });
  if (res.status !== 0) fail(`失敗しました: ${command} ${args.join(" ")}`);
}

function loadConfig() {
  const path = resolve(root, option("config", "deploy/production.json"));
  if (!existsSync(path)) fail(`本番設定のファイルが見つかりません: ${relative(root, path)}（deploy/production.example.json をコピーして作ります）`);
  let d;
  try {
    d = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`本番設定が JSON として読めません: ${relative(root, path)}（${error.message}）`);
  }
  const errors = validateProductionConfig(d);
  if (errors.length > 0) fail(`本番設定に誤りがあります:\n- ${errors.join("\n- ")}`);
  return d;
}

function check() {
  const d = loadConfig();
  const base = JSON.parse(stripJsonc(readFileSync(join(root, "wrangler.jsonc"), "utf8")));
  writeFileSync(join(root, GENERATED_CONFIG), `${JSON.stringify(renderWranglerConfig(base, d), null, 2)}\n`);
  console.log(`✓ 本番設定は正しい形式です。${GENERATED_CONFIG} を書き出しました`);
  console.log(`  公開: https://${d.siteHost}（Worker: ${d.workerName}） / CMS: ${d.cmsBaseUrl}（サイト: ${d.cmsSiteKey}）`);
  return d;
}

// 開発用の値のファイル。ビルドはこれを環境変数より優先して読み、dist/server にも複製する。
// 本番のビルドに混ざると、Turnstile のテスト用キーが埋め込まれ、手元の公開キーが成果物に残るため、ビルドの間だけ退避する。
const DEV_VARS_FILES = [".dev.vars", ".env"];

function build(d) {
  const moved = DEV_VARS_FILES.filter((f) => existsSync(join(root, f))).map((f) => {
    const aside = `${f}.release-backup`;
    renameSync(join(root, f), join(root, aside));
    return [f, aside];
  });
  try {
    // astro.config.mjs が WRANGLER_CONFIG・SITE_URL を読む。PUBLIC_TURNSTILE_SITE_KEY は astro:env がビルド時に埋め込む。
    run("pnpm", ["exec", "astro", "build"], {
      WRANGLER_CONFIG: GENERATED_CONFIG,
      SITE_URL: `https://${d.siteHost}`,
      PUBLIC_TURNSTILE_SITE_KEY: d.turnstileSiteKey,
    });
  } finally {
    for (const [f, aside] of moved) renameSync(join(root, aside), join(root, f));
  }
  if (existsSync(join(root, "dist", "server", ".dev.vars"))) fail("ビルド結果に .dev.vars が含まれています。デプロイを中止します");
  console.log("✓ 本番の値でビルドしました");
}

const command = process.argv[2];
switch (command) {
  case "check":
    check();
    break;
  case "build":
    build(check());
    break;
  case "deploy": {
    const d = check();
    if (!process.argv.includes("--yes")) {
      console.log(`\n実行する内容: 本番の値でビルドし、https://${d.siteHost} に Worker「${d.workerName}」をデプロイする`);
      console.log("実行するには --yes を付けてください。");
      break;
    }
    build(d);
    // ビルドが書き出した設定（dist/server/wrangler.json）を wrangler が自動で使う。
    run("pnpm", ["exec", "wrangler", "deploy"]);
    console.log(`✓ デプロイしました: https://${d.siteHost}`);
    break;
  }
  default:
    fail("使い方: pnpm release <check|build|deploy> [--config deploy/production.json] [--yes]");
}
