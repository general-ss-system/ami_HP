/**
 * ローカルの CMS に、仮データ（src/lib/cms/fixtures.ts）と同じ内容を登録して公開する。
 *
 * 画面で使っている仮データと CMS の中身を一致させ、CMS_MODE=live に切り替えても同じ表示になることを確かめるためのもの。
 * **ローカル専用。** 本番の CMS には使わない（本番の初期データはクライアントが管理画面で入れる）。
 *
 * 前提（CMS リポジトリ側）:
 *   pnpm dev
 *   pnpm -F @ss/backend run dev:bootstrap -- --site ami --name "合同会社ami" --preset ami
 *   → 最後に表示される「管理画面へのログインURL」の token=... の部分を控える
 *
 * 使い方（このリポジトリで）:
 *   pnpm seed:cms -- --token <ログインURLの token>
 *
 * オプション: --api http://localhost:8787 / --site ami
 * 同じサイトに2回実行すると、記事が重複して登録される（新しく作ったサイトに1回だけ実行する）。
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureHome, fixtureMembers, fixtureServices, fixtureTopics } from "../src/lib/cms/fixtures.ts";

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
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API)) {
  console.error(`ローカルの CMS 以外には実行できません: ${API}`);
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
  console.error(`サイト「${SITE_KEY}」がありません。dev:bootstrap に --site ${SITE_KEY} --preset ami を付けて実行してください。`);
  process.exit(1);
}
const S = `/api/v1/admin/sites/${site.id}`;

// ---- 画像のアップロード（同じ画像は1回だけ） ----
const uploaded = new Map(); // 仮データの media.id → CMS の media id

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

/** 配信形式（展開済みの media）を、保存形式（ID 参照）に戻す。 */
async function toStored(content) {
  const out = {};
  for (const [key, value] of Object.entries(content)) {
    if (Array.isArray(value) && value.every(isMedia)) out[key] = await Promise.all(value.map(toRef));
    else if (isMedia(value)) out[key] = await toRef(value);
    else out[key] = value;
  }
  return out;
}

function isMedia(v) {
  return v !== null && typeof v === "object" && "url" in v && "mimeType" in v;
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
  console.log(`✓ ${modelKey}${entry.slug ? ` / ${entry.slug}` : ""}`);
}

console.log(`… ${API} のサイト「${SITE_KEY}」に仮データを登録します`);
await createAndPublish("ami_home", fixtureHome);
for (const e of fixtureServices) await createAndPublish("ami_services", e);
for (const e of fixtureTopics) await createAndPublish("ami_topics", e);
for (const e of fixtureMembers) await createAndPublish("members", e);
console.log("完了しました。公開サイトの .dev.vars を CMS_MODE=live にして確認してください。");
