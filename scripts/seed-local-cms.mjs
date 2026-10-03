/**
 * ローカルの CMS に、仮データ（src/lib/cms/fixtures.ts）と同じ内容を登録して公開する。
 *
 * 画面で使っている仮データと CMS の中身を一致させ、CMS_MODE=live に切り替えても同じ表示になることを確かめるためのもの。
 * **ローカル専用。** 本番の CMS には使わない（本番の初期データはクライアントが管理画面で入れる）。
 *
 * 前提（CMS リポジトリ ami-cms 側）:
 *   pnpm dev
 *   pnpm -F @ss/backend run dev:bootstrap
 *   → 表示される「Delivery API 公開キー」と「管理画面へのログインURL」の token=... の部分を控える
 *
 * 使い方（このリポジトリで）:
 *   pnpm seed:cms -- --token <ログインURLの token>
 *
 * することの順番:
 *   1. サイトに ami のモデル（preset "ami"）とフォーム（ami_contact）を有効にする
 *   2. 仮データを登録して公開する（画像はアップロードし、rich_text の画像・relation も CMS の保存形式に直す）
 *
 * オプション: --api http://localhost:8787 / --site ami
 * 同じサイトに2回実行すると、記事が重複して登録される（新しく作ったサイトに1回だけ実行する）。
 *
 * 例外: 先方に見せる確認用の環境（R2 の有効化前など / CMS ADR-032）に仮データを入れるときだけ、
 * 本番の CMS の URL を --allow-remote に同じ値で重ねて指定すると実行できる。記事が1件でもあるサイトには実行しない。
 *   pnpm seed:cms -- --api https://ami-cms.ami-cms.workers.dev --allow-remote https://ami-cms.ami-cms.workers.dev --token …
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fixtureAbout,
  fixtureContactPage,
  fixtureFaqs,
  fixtureHome,
  fixtureJobPositions,
  fixtureMembers,
  fixtureRecruit,
  fixtureServiceCases,
  fixtureServicePage,
  fixtureServices,
  fixtureSiteInfo,
  fixtureTopics,
  fixtureWorks,
} from "../src/lib/cms/fixtures.ts";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const API = arg("api", "http://localhost:8787").replace(/\/+$/, "");
const SITE_KEY = arg("site", "ami");
const TOKEN = arg("token");

if (!TOKEN) {
  console.error("--token が必要です（dev:bootstrap が表示するログインURLの token=... の部分）");
  process.exit(1);
}
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API);
// 本番の CMS に誤って入れないよう、URL を2回（--api と --allow-remote）一致させたときだけ許す
const ALLOW_REMOTE = arg("allow-remote", "")?.replace(/\/+$/, "");
if (!IS_LOCAL && !(ALLOW_REMOTE === API && API.startsWith("https://"))) {
  console.error(`ローカルの CMS 以外には実行できません: ${API}（確認用の環境に入れるときは --allow-remote に同じ URL を指定）`);
  process.exit(1);
}

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

async function api(path, init = {}, cookie) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

function must(res, expected, what) {
  if (res.status !== expected) {
    console.error(`${what}に失敗しました (HTTP ${res.status})`, JSON.stringify(res.body));
    process.exit(1);
  }
  return res.body;
}

// ---- ログイン ----
const login = await api("/api/v1/auth/verify", { method: "POST", body: JSON.stringify({ token: TOKEN }) });
must(login, 200, "ログイン（token は1回しか使えません。dev:bootstrap をもう一度実行して新しい token を使ってください）");
const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

const sites = must(await api("/api/v1/admin/sites", {}, cookie), 200, "サイト一覧の取得");
const site = sites.data.find((s) => s.key === SITE_KEY);
if (!site) {
  console.error(`サイト「${SITE_KEY}」がありません。dev:bootstrap に --site ${SITE_KEY} を付けて実行してください。`);
  process.exit(1);
}
const S = `/api/v1/admin/sites/${site.id}`;

// ---- モデルとフォームを有効にする ----
const models = must(await api(`${S}/models`, { method: "POST", body: JSON.stringify({ preset: "ami" }) }, cookie), 200, "モデルの有効化");
console.log(`✓ モデル: ${[...models.enabled, ...models.synced].join(", ") || "（変更なし）"}`);
const forms = must(await api(`${S}/forms`, { method: "POST", body: JSON.stringify({ formKeys: ["ami_contact"] }) }, cookie), 200, "フォームの有効化");
console.log(`✓ フォーム: ${[...forms.enabled, ...forms.synced].join(", ") || "（変更なし）"}`);

// 確認用の環境では、入力済みの内容と混ざらないよう、記事が1件でもあれば止める
if (!IS_LOCAL) {
  const existing = must(await api(`${S}/models/ami_topics/entries`, {}, cookie), 200, "既存の記事の確認");
  if ((existing.data ?? []).length > 0) {
    console.error("このサイトには既に記事があります。仮データは新しく作ったサイトにだけ入れます。");
    process.exit(1);
  }
}

// ---- 画像のアップロード（同じ画像は1回だけ） ----
const uploaded = new Map(); // 仮データの media.id → CMS の media id
const entryIds = new Map(); // 仮データの entry.id → CMS の entry id（relation 用）

async function toRef(media) {
  if (!uploaded.has(media.id)) {
    const file = basename(media.url);
    const bytes = await readFile(`${publicDir}fixtures/${file}`);
    const form = new FormData();
    form.set("file", new File([bytes], file, { type: media.mimeType }));
    if (media.alt) form.set("alt", media.alt);
    const res = await fetch(`${API}${S}/media`, { method: "POST", headers: { Cookie: cookie }, body: form });
    const json = await res.json().catch(() => null);
    must({ status: res.status, body: json }, 201, `画像のアップロード（${file}）`);
    uploaded.set(media.id, json.media.id);
    console.log(`  画像: ${file}`);
  }
  return { $ref: "media", id: uploaded.get(media.id) };
}

function isMedia(v) {
  return v !== null && typeof v === "object" && "url" in v && "mimeType" in v;
}

function isEntryRef(v) {
  return v !== null && typeof v === "object" && "model" in v && "id" in v && "slug" in v && !("url" in v);
}

/** 配信形式（展開済みの media・entry）を、保存形式（ID 参照）に戻す。rich_text の中の画像も直す。 */
async function toStored(value) {
  if (Array.isArray(value)) return Promise.all(value.map(toStored));
  if (isMedia(value)) return toRef(value);
  if (isEntryRef(value)) {
    const id = entryIds.get(value.id);
    if (!id) throw new Error(`参照先がまだ登録されていません: ${value.model} ${value.id}`);
    return { $ref: "entry", id };
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await toStored(v);
    return out;
  }
  return value;
}

async function createAndPublish(modelKey, entry) {
  const data = await toStored(entry.content);
  const body = { ...(entry.slug ? { slug: entry.slug } : {}), data };
  const created = must(
    await api(`${S}/models/${modelKey}/entries`, { method: "POST", body: JSON.stringify(body) }, cookie),
    201,
    `${modelKey} の登録`,
  );
  must(
    await api(
      `${S}/entries/${created.entry.id}/publish`,
      { method: "POST", body: JSON.stringify({ expectedVersion: created.entry.version }) },
      cookie,
    ),
    200,
    `${modelKey} の公開`,
  );
  entryIds.set(entry.id, created.entry.id);
  console.log(`✓ ${modelKey}${entry.slug ? ` / ${entry.slug}` : ""}`);
}

console.log(`… ${API} のサイト「${SITE_KEY}」に仮データを登録します`);
// relation の参照先（ami_services）を先に登録する
await createAndPublish("site_info", fixtureSiteInfo);
await createAndPublish("about", fixtureAbout);
await createAndPublish("contact_page", fixtureContactPage);
await createAndPublish("ami_home", fixtureHome);
await createAndPublish("ami_service_page", fixtureServicePage);
await createAndPublish("recruit", fixtureRecruit);
for (const e of fixtureServices) await createAndPublish("ami_services", e);
for (const e of fixtureServiceCases) await createAndPublish("ami_service_cases", e);
for (const e of fixtureTopics) await createAndPublish("ami_topics", e);
for (const e of fixtureMembers) await createAndPublish("members", e);
for (const e of fixtureWorks) await createAndPublish("works", e);
for (const e of fixtureJobPositions) await createAndPublish("job_positions", e);
for (const e of fixtureFaqs) await createAndPublish("faq", e);
console.log("完了しました。公開サイトの .dev.vars を CMS_MODE=live にして確認してください。");
