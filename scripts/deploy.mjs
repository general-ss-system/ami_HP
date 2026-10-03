#!/usr/bin/env node
/**
 * 公開サイトを本番へ出す（CMS docs/05 ADR-031）。
 *
 *   pnpm release <コマンド> [--config deploy/production.json] [--yes]
 *
 *   check           本番設定を検証し、下書きプレビュー用 Worker の設定（wrangler.production.json）を書き出す（どこにも触れない）
 *   build           check のうえで、CMS の公開中の内容を読んで静的な HTML を dist/ に書き出し、CMS の画像を取り込む
 *   upload          dist/ を Xserver に SSH で置く。--yes を付けたときだけ実行する
 *   deploy          build と upload を続けて行う。--yes を付けたときだけ実行する
 *   preview-deploy  下書きプレビュー用の Worker（workers.dev）をビルドしてデプロイする。--yes を付けたときだけ実行する
 *
 * build には CMS の公開キーを環境変数 CMS_DELIVERY_KEY で渡す（設定ファイルに書かない）。
 * upload は ssh と rsync を使う（GitHub Actions・Mac・Linux。Windows では WSL か Actions から）。
 * preview-deploy の認証は `wrangler login` か、環境変数 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID。
 * 本番の値の置き場所と手順は docs/deploy.md。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderPreviewWranglerConfig, stripJsonc, validateProductionConfig } from "../src/lib/deploy/production-config.ts";
import { LOCAL_MEDIA_PREFIX, apacheConfig, collectMediaKeys, rewriteMediaUrls } from "../src/lib/deploy/static-media.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
export const GENERATED_CONFIG = "wrangler.production.json";
/** Xserver に置いたファイルの一覧。次回のアップロードで、消えたページ・画像だけを消すのに使う（他のファイルには触れない）。 */
const MANIFEST = ".ami-hp-manifest";
/** 取り込む画像1枚の上限。CMS のアップロード上限より大きくしておく。 */
const MAX_MEDIA_BYTES = 30 * 1024 * 1024;
/** CMS の URL を探す対象（画像は除く）。 */
const TEXT_FILE = /\.(html|xml|txt|json|css|js|mjs|webmanifest)$/;

function option(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, env = {}, input = undefined) {
  const res = spawnSync(command, args, {
    cwd: root,
    stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
    input,
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
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
  writeFileSync(join(root, GENERATED_CONFIG), `${JSON.stringify(renderPreviewWranglerConfig(base, d), null, 2)}\n`);
  console.log(`✓ 本番設定は正しい形式です。${GENERATED_CONFIG} を書き出しました`);
  console.log(`  公開: https://${d.siteHost}（Xserver: ${d.xserver ? `${d.xserver.user}@${d.xserver.host}:${d.xserver.path}` : "未設定。アップロードの前に deploy/production.json の xserver を入れる"}）`);
  console.log(`  CMS: ${d.cmsBaseUrl}（サイト: ${d.cmsSiteKey}） / 下書きプレビュー: https://${d.preview.host}`);
  return d;
}

// 開発用の値のファイル。ビルドはこれを環境変数より優先して読み、dist/server にも複製する。
// 本番のビルドに混ざると、Turnstile のテスト用キーが埋め込まれ、手元の公開キーが成果物に残るため、ビルドの間だけ退避する。
const DEV_VARS_FILES = [".dev.vars", ".env"];

function astroBuild(env) {
  // Astro は dist/ を空にしない。前のビルド（SSR の dist/server など）が Xserver に置かれないよう、先に消す。
  rmSync(dist, { recursive: true, force: true });
  const moved = DEV_VARS_FILES.filter((f) => existsSync(join(root, f))).map((f) => {
    const aside = `${f}.release-backup`;
    renameSync(join(root, f), join(root, aside));
    return [f, aside];
  });
  try {
    run("pnpm", ["exec", "astro", "build"], env);
  } finally {
    for (const [f, aside] of moved) renameSync(join(root, aside), join(root, f));
  }
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map((name) => join(dir, String(name)))
    .filter((path) => statSync(path).isFile())
    .map((path) => relative(dir, path).split(sep).join("/"));
}

/** 書き出した HTML などに含まれる CMS の画像を dist/media/ に取り込み、URL を書き換える。 */
async function importMedia(d) {
  const mediaBase = `${d.cmsBaseUrl}/media`;
  const textFiles = listFiles(dist).filter((f) => TEXT_FILE.test(f));
  const keys = new Set(textFiles.flatMap((f) => collectMediaKeys(readFileSync(join(dist, f), "utf8"), mediaBase)));

  for (const key of keys) {
    const res = await fetch(`${mediaBase}/${key}`, { redirect: "error", signal: AbortSignal.timeout(60_000) });
    if (!res.ok) fail(`CMS の画像を取り込めません（${res.status}）: ${key}`);
    const body = new Uint8Array(await res.arrayBuffer());
    if (body.byteLength > MAX_MEDIA_BYTES) fail(`CMS の画像が大きすぎます（${body.byteLength} バイト）: ${key}`);
    const out = join(dist, ...LOCAL_MEDIA_PREFIX.split("/").filter(Boolean), ...key.split("/"));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, body);
  }

  const siteOrigin = `https://${d.siteHost}`;
  for (const f of textFiles) {
    const path = join(dist, f);
    const text = readFileSync(path, "utf8");
    const rewritten = rewriteMediaUrls(text, mediaBase, siteOrigin);
    if (rewritten !== text) writeFileSync(path, rewritten);
  }
  console.log(`✓ CMS の画像を ${keys.size} 件取り込みました`);
}

async function build(d) {
  const deliveryKey = process.env.CMS_DELIVERY_KEY;
  if (!deliveryKey) fail("環境変数 CMS_DELIVERY_KEY（CMS の公開キー）が必要です。設定ファイルには書きません");

  astroBuild({
    BUILD_TARGET: "xserver",
    CMS_MODE: "live",
    CMS_BASE_URL: d.cmsBaseUrl,
    CMS_SITE_KEY: d.cmsSiteKey,
    CMS_DELIVERY_KEY: deliveryKey,
    SITE_URL: `https://${d.siteHost}`,
    PUBLIC_TURNSTILE_SITE_KEY: d.turnstileSiteKey,
  });
  // 仮データ（CMS_MODE=fixture）用の画像。本番は CMS の画像を使うので置かない。
  rmSync(join(dist, "fixtures"), { recursive: true, force: true });
  await importMedia(d);
  writeFileSync(join(dist, ".htaccess"), apacheConfig());

  // 公開キーは静的な成果物に入らない作り（astro:env の secret）だが、念のため置く前に確かめる。
  const leaked = listFiles(dist)
    .filter((f) => TEXT_FILE.test(f) || f.endsWith(".htaccess"))
    .filter((f) => readFileSync(join(dist, f), "utf8").includes(deliveryKey));
  if (leaked.length > 0) fail(`ビルド結果に CMS の公開キーが含まれています。アップロードしません: ${leaked.join(", ")}`);

  const files = listFiles(dist).filter((f) => f !== MANIFEST).sort();
  writeFileSync(join(dist, MANIFEST), `${files.join("\n")}\n`);
  console.log(`✓ 静的なサイトを書き出しました（${files.length} ファイル）`);
}

/** Xserver の項目が無い設定（下書きプレビュー用 Worker だけ先に出す段階）ではアップロードしない。 */
function requireXserver(d) {
  if (!d.xserver) fail("deploy/production.json に xserver（Xserver の SSH の接続先）がありません。docs/deploy.md §4.2");
}

function sshArgs(d) {
  return ["-p", String(d.xserver.port), "-o", "BatchMode=yes"];
}

function upload(d) {
  if (!existsSync(join(dist, MANIFEST))) fail("dist/ が Xserver 向けのビルドではありません。先に pnpm release build を実行してください");
  const dest = `${d.xserver.user}@${d.xserver.host}`;
  const path = d.xserver.path; // 空白・引用符を含まないことは validateProductionConfig で確かめている

  // 前回置いたファイルの一覧（初回は無い）
  const prev = spawnSync("ssh", [...sshArgs(d), dest, `cat '${path}/${MANIFEST}' 2>/dev/null || true`], { encoding: "utf8" });
  if (prev.status !== 0) fail(`Xserver に SSH でつながりません（${dest}:${d.xserver.port}）`);
  const previous = prev.stdout.split("\n").filter(Boolean);
  const current = new Set(readFileSync(join(dist, MANIFEST), "utf8").split("\n").filter(Boolean));

  // 先に新しいファイルを置き（公開中のページが欠ける時間を作らない）、そのあとで消えたものだけを消す。
  // --delete は使わない。同じ場所に先方のファイルがあっても消さないため。
  run("rsync", ["-rltz", "--chmod=D755,F644", "-e", `ssh ${sshArgs(d).join(" ")}`, "dist/", `${dest}:${path}/`]);

  const stale = previous.filter((f) => !current.has(f) && !f.startsWith("/") && !f.split("/").includes(".."));
  if (stale.length > 0) {
    run("ssh", [...sshArgs(d), dest, `cd '${path}' && xargs -d '\\n' rm -f --`], {}, `${stale.join("\n")}\n`);
    console.log(`✓ 公開をやめたファイルを ${stale.length} 件消しました`);
  }
  console.log(`✓ Xserver に置きました: https://${d.siteHost}`);
}

function previewDeploy(d) {
  // astro:env の public な値はビルドの時点で埋め込まれる（wrangler の vars は実行時には読まれない）ため、ここで渡す。
  // Secret（CMS_DELIVERY_KEY・CMS_WEBHOOK_SECRET・GITHUB_DISPATCH_TOKEN）は実行時に Worker の Secret から読む。
  astroBuild({
    BUILD_TARGET: "preview-worker",
    WRANGLER_CONFIG: GENERATED_CONFIG,
    CMS_MODE: "live",
    CMS_BASE_URL: d.cmsBaseUrl,
    CMS_SITE_KEY: d.cmsSiteKey,
    GITHUB_REPO: d.preview.githubRepo,
    SITE_URL: `https://${d.preview.host}`,
    PUBLIC_TURNSTILE_SITE_KEY: d.turnstileSiteKey,
  });
  if (existsSync(join(dist, "server", ".dev.vars"))) fail("ビルド結果に .dev.vars が含まれています。デプロイを中止します");
  // 不足していると、プレビューが仮データ（fixture）のまま公開されてしまうため、成果物で確かめる。
  const bundled = listFiles(join(dist, "server")).filter((f) => /\.m?js$/.test(f)).some((f) => readFileSync(join(dist, "server", f), "utf8").includes(d.cmsBaseUrl));
  if (!bundled) fail("ビルド結果に CMS の接続先が含まれていません。デプロイを中止します");
  // ビルドが書き出した設定（dist/server/wrangler.json）を wrangler が自動で使う。
  run("pnpm", ["exec", "wrangler", "deploy"]);
  console.log(`✓ 下書きプレビュー用の Worker をデプロイしました: https://${d.preview.host}`);
}

function confirmed(text) {
  if (process.argv.includes("--yes")) return true;
  console.log(`\n実行する内容: ${text}\n実行するには --yes を付けてください。`);
  return false;
}

const command = process.argv[2];
switch (command) {
  case "check":
    check();
    break;
  case "build":
    await build(check());
    break;
  case "upload": {
    const d = check();
    requireXserver(d);
    if (confirmed(`dist/ を ${d.xserver.user}@${d.xserver.host}:${d.xserver.path} に置く（https://${d.siteHost}）`)) upload(d);
    break;
  }
  case "deploy": {
    const d = check();
    requireXserver(d);
    if (!confirmed(`CMS の公開中の内容でビルドし、${d.xserver.host}:${d.xserver.path} に置く（https://${d.siteHost}）`)) break;
    await build(d);
    upload(d);
    break;
  }
  case "preview-deploy": {
    const d = check();
    if (confirmed(`下書きプレビュー用の Worker「${d.preview.workerName}」をビルドしてデプロイする（https://${d.preview.host}）`)) previewDeploy(d);
    break;
  }
  default:
    fail("使い方: pnpm release <check|build|upload|deploy|preview-deploy> [--config deploy/production.json] [--yes]");
}
