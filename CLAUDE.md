# Project Instructions — 合同会社ami 公式サイト

合同会社ami のコーポレートサイト（公開側）。コンテンツは別リポジトリのヘッドレスCMS
（ss-hp-public-system、以下「CMS」）の Delivery API から取得する。

## 1. 正本

- デザイン: Figma「株式会社ami ホームページデザイン」 top フレーム（node 226:236、PC 1280px）。
  スマホ版のデザインは無い。レスポンシブはこのリポジトリで設計する。
- 素材の元データ: `202511_Amiホームページ/ami HP/ami HP 素材/`（Git 管理外）。`src/assets/` に英数字名で取り込んで使う。
- CMS 連携の規約: CMS リポジトリ（general-ss-system/ami-cms。このリポジトリと同じ階層の `ami-cms/`）の `docs/04_WEBSITE_CMS_INTEGRATION_RULES.md`（必読）、
  `docs/02_BACKEND_DATA_API_SPEC.md`、案件別の `docs/projects/ami/CONTENT_CONTRACT.md`。
- API の応答の型: `src/lib/cms/contracts.ts`（CMS の `packages/contracts` の写し。手で書き換えない）。

- ページの作り方（手順とプロンプト）: `docs/page-development-guide.md`。新しいページはこの手順で作り、分かったことを追記する。
- 現状と残りの作業（別のデバイスで続けるとき）: `docs/HANDOFF.md`。

## 2. 技術構成

- Astro（SSR, `output: "server"`）+ `@astrojs/cloudflare`。Cloudflare Workers にデプロイ。
- パッケージマネージャは pnpm。
- Frontend 側にキャッシュ層（ISR 等）を足さない。反映は CMS 側の CDN タグパージだけで行う（ADR-022）。

## 3. ディレクトリ

```text
src/
  assets/        手元の画像（WebP）・フォント。装飾・見出し・背景など、コードで管理するもの
    headings/    英字見出しの画像
    decor/       ドット絵の装飾（Decor コンポーネントで配置）
  components/
    layout/      ヘッダー・フッター・ロゴ
    sections/    トップページのセクション
    ui/          Decor / CmsImage / SectionHeading / ViewMore など
  config/        ナビなど、コードで管理するサイト構造
  layouts/       <html> の枠
  lib/cms/       CMS クライアント層（ここ以外で fetch しない）
    contracts.ts   API の応答の型（CMS の写し）
    schemas.ts     モデルごとの content の検証（CMS の key のまま）
    types.ts       画面で使う型
    mapper.ts      CMS の応答 → 画面の型
    queries.ts     ページ単位の取得（getTopPageData）
    fixtures.ts    仮データ（CMS の応答と同じ形）
  pages/
  styles/        tokens.css（色・余白・フォント）と global.css
public/fixtures/ 仮データ用の画像
docs/            Content Model の案など
scripts/         素材の変換
```

## 3.5 レイアウトの作り方

- デザインは PC 1280px のみ。各セクションは `.stage`（最大 1280px、container-type: inline-size）の中に組む。
- 装飾は `Decor` に PC デザイン上の座標 `pc={[x, y, 幅]}` を渡す。`.stage` の幅に比例して動く（cqw）。
  スマホは `sp={[x, y, 幅]}`（375px 基準）か `sp={false}`（出さない）。
- **`.stage` に左右の padding を付けない。** cqw は container の内容の幅が基準なので、左右に余白があると
  `Decor` の位置や cqw の余白が 1200/1280 にずれる。左右の余白（`var(--gutter)`）は中身の要素に付ける。
- 下層ページのデザイン（service / member / topics / contact）は `design/`（SVG と要素ごとの CSV）。
  ドット絵のタイトルなどの部品は `scripts/design-extract.mjs` でデザインの SVG から取り出す（`design/README.md`）。
- ブレークポイント: スマホ 〜767px / タブレット 〜1023px（ヘッダーはメニューボタン）/ PC 1024px〜。
- **サイト内リンク・パスは `withBase()` を通す**（GitHub Pages のプレビューは `/ami_HP/` の下に置かれる）。
  フォント・背景画像など CSS から参照するファイルは `public/` ではなく `src/assets/` に置き、相対パスで参照する。
- 手元の画像は `LocalImage`、CMS の画像は `CmsImage` で出す（astro:assets の `<Image>` は使わない）。
  どちらも `alt=""`（CMS の alt が空）のときは `aria-hidden="true"` を自動で付ける。装飾の画像は `alt=""` で渡す。
- **SSR のため、`src/assets` の画像は実行時に変換されない。** 素材は WebP・表示サイズの 2 倍程度にしてから置く
  （`pnpm assets:webp`）。

## 4. 絶対に守ること

- **API 呼び出しは `src/lib/cms/` に集める。** UI コンポーネントから fetch しない。ページで取得して props で渡す。
- **CMS の値を固定文言で黙って補わない。** `cms.title || "..."` は禁止。任意項目が空なら UI ごと出さない。
  ただし `CMS_MODE=fixture` の仮データは制作中の表示用として使ってよい。
- 画像は CMS が返す `url` をそのまま使い、CMS のドメインをハードコードしない。`width` / `height` を必ず指定する。
- レイアウト・余白・色・動き・ナビの構成はコードで管理する（CMS にしない）。
- Delivery の公開キー（`CMS_DELIVERY_KEY`）をリポジトリに入れない。ローカルは `.dev.vars`、本番は `wrangler secret`。
- 動きは `prefers-reduced-motion` で止められるようにする。

## 5. コマンド

```bash
pnpm dev          # 開発サーバー（http://localhost:4321）。バックグラウンドなら pnpm astro dev --background
pnpm check        # 型チェック（astro check）
pnpm test         # 単体テスト（vitest）
pnpm build        # 本番ビルド
pnpm preview      # ビルド結果を workerd で確認
```

変更後は `pnpm check` → `pnpm test` → `pnpm build` を通してから完了とする（GitHub Pages のプレビューに関わる変更は `pnpm build:pages` も）。

pnpm が PATH に無い環境では `corepack pnpm <コマンド>` で動かす（`build:pages` は astro を Node で直接起動するので、そのままで動く）。

### 公開前の点検（2026-09-27 に実施）

- `pnpm build:pages` の `dist/` を走査して、画像の width/height・装飾の alt/aria-hidden・h1 が 1 つ・見出しの飛ばし・
  サイト内リンクと画像の `/ami_HP/` 付きを確かめる（Git Bash では引数の `/ami_HP/` が Windows のパスに変換されるので `MSYS_NO_PATHCONV=1` を付ける）。
- CMS の任意項目が空のときの確認は、仮データから必須の項目以外を消してビルドし、空の要素や `undefined` が出ないことを見る。
- 幅 375 / 820 / 1440 で全ページに横スクロールが出ないこと（Topics の流れる帯・カードの横スクロールは意図どおり）。
- 動きは global.css の `prefers-reduced-motion` で一括で止め、ヒーローの写真の入れ替え（JS）も同じ設定で止める。
- Figma MCP は View 席だと呼び出し回数の上限がある。上限に達するとデザインとの突き合わせができない。

## 6. CMS とのつなぎ方

- `CMS_MODE=fixture`（既定）: 仮データで表示する。CMS が無くても制作できる。
- `CMS_MODE=live`: `CMS_BASE_URL` / `CMS_SITE_KEY` / `CMS_DELIVERY_KEY` で Delivery API から取得する。
  ローカルの CMS は、ami-cms で `pnpm dev` → `pnpm -F @ss/backend dev:bootstrap` を実行すると、公開キーと下書きプレビュー用URLを含めて用意される。
  そのあとこのリポジトリで `pnpm seed:cms -- --token <ログインURLの token>` を実行すると、ami のモデル・フォームを有効にして、全ページの仮データを登録する。
  （dev:bootstrap を実行するたびに公開キーが発行し直されるので、`.dev.vars` の `CMS_DELIVERY_KEY` も差し替える。ログインの token は 1 回しか使えない）

## 7. Astro のドキュメント

https://docs.astro.build （ルーティング、コンポーネント、画像、環境変数は該当ガイドを確認してから実装する）
