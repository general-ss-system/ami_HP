# 株式会社ami 公式サイト

Astro（SSR）+ Cloudflare Workers。コンテンツはヘッドレスCMS（ss-hp-public-system）の Delivery API から取得する。

## はじめかた

```bash
pnpm install
cp .dev.vars.example .dev.vars   # CMS 無しで作業するなら CMS_MODE=fixture のままでよい
pnpm dev                         # http://localhost:4321
```

## コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー |
| `pnpm check` | 型チェック |
| `pnpm test` | 単体テスト |
| `pnpm build` | 本番ビルド |
| `pnpm preview` | ビルド結果を手元の workerd で確認 |
| `pnpm deploy` | ビルドして Cloudflare にデプロイ |
| `pnpm assets:webp` | `src/assets/` の PNG を WebP に変換 |

## 環境変数

| 名前 | 置き場所 | 内容 |
|---|---|---|
| `CMS_MODE` | `wrangler.jsonc` / `.dev.vars` | `fixture`（仮データ）か `live`（CMS から取得） |
| `CMS_BASE_URL` | `.dev.vars` / Cloudflare の変数 | CMS の URL（例: `https://cms.example.co.jp`） |
| `CMS_SITE_KEY` | 同上 | CMS のサイトキー |
| `CMS_DELIVERY_KEY` | `.dev.vars` / `wrangler secret put` | Delivery API の公開キー（`ssdk_...`）。コミットしない |

## 素材の差し替え

`src/assets/` の画像は WebP で持つ（トップページは SSR のため、置いたファイルがそのまま配信される）。

1. 差し替える画像を、同じ名前の `.png` で置く
2. `pnpm assets:webp` を実行する（PNG → WebP に変換し、PNG を削除する）

- 英字見出し（Our Business / Topics / Member など）は `src/assets/headings/`。
  - `topics.webp` は誤字（Tpics）の修正待ち。修正版が届いたら `src/assets/headings/topics.png` として置いて上の手順を行う。
- フォント（魔導太丸ゴシック）は `public/fonts/`。手順は `public/fonts/README.md`。
- `public/fixtures/` は仮データ（`CMS_MODE=fixture`）用の画像。本番では CMS の画像を使う。

開発の約束事は `CLAUDE.md` を参照。
