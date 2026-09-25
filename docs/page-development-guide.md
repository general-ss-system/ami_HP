# 下層ページの作り方（合同会社ami 公式サイト）

トップページと同じ品質・同じ作り方で、下層ページ（ABOUT / SERVICE / MEMBER / TOPICS / お問い合わせ など）を作るための手順書です。
初めてこのプロジェクトに入る人でも、上から順に進めれば1ページを完成させられるように書いています。

各ステップに **Claude Code（または Cursor）にそのまま貼れるプロンプト** を付けています。
`〈 〉` の部分だけ、作るページに合わせて書き換えてください。

> 社名は **合同会社ami** です（株式会社ではありません）。画面・文書・コミットメッセージのすべてで統一してください。

---

## 目次

1. [全体像](#1-全体像)
2. [最初の準備（1回だけ）](#2-最初の準備1回だけ)
3. [毎日の起動](#3-毎日の起動)
4. [1ページを作る流れ（10ステップ）](#4-1ページを作る流れ10ステップ)
5. [特別な作りが必要なページ](#5-特別な作りが必要なページ)
6. [守ること・やってはいけないこと](#6-守ることやってはいけないこと)
7. [困ったとき](#7-困ったとき)
8. [提出前のチェックリスト](#8-提出前のチェックリスト)
9. [参考：ファイルの場所](#9-参考ファイルの場所)

---

## 1. 全体像

このサイトは **2つのリポジトリ** でできています。

```text
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ CMS（管理画面とデータ）         │        │ 公開サイト（このリポジトリ）     │
│ general-ss-system/            │ 配信API │ general-ss-system/ami_HP      │
│   SS-HP-PUBLIC-SYSTEM         │ ─────▶ │ Astro（SSR）+ Cloudflare       │
│ ・どんな項目があるか（モデル）   │        │ ・見た目・動き・レイアウト       │
│ ・クライアントが入れる文章や写真 │        │ ・CMS から取った値を表示する     │
└──────────────────────────────┘        └──────────────────────────────┘
```

- **CMS に入れるもの**：クライアントが公開後に変えたいもの（文章・写真・記事・メンバーなど）
- **コードで持つもの**：レイアウト・余白・色・フォント・動き・装飾のイラスト・ナビの構成

公開サイトは、次の2つのモードを切り替えて動きます（`.dev.vars` の `CMS_MODE`）。

| モード | データの出どころ | 使う場面 |
|---|---|---|
| `fixture` | `src/lib/cms/fixtures.ts`（仮データ） | CMS を起動せずに画面を作るとき |
| `live` | ローカル（または本番）の CMS | CMS とつないで確認するとき |

仮データは **CMS の応答と同じ形** で書いてあるので、`live` に切り替えても画面の作りは変わりません。

---

## 2. 最初の準備（1回だけ）

### 2.1 必要なもの

| もの | 確認方法 | 備考 |
|---|---|---|
| Node.js 22.12 以上 | `node -v` | |
| pnpm 10 | `pnpm -v` | **npm は使わない**（CMS 側のテストが壊れる） |
| Git / GitHub のアクセス権 | `gh auth status` | 2つのリポジトリに書き込めること |
| Figma のアクセス権 | ― | デザインのファイルがあるチームの **Full 席か Dev 席** |
| Claude Code | `claude --version` | Figma は **design プラグインの Figma 接続** を使う（§7） |

### 2.2 リポジトリを取ってくる

2つを **同じフォルダの中に並べて** 置きます。

```bash
git clone https://github.com/general-ss-system/SS-HP-PUBLIC-SYSTEM.git "ami HP"
git clone https://github.com/general-ss-system/ami_HP.git ami_HP

cd "ami HP" && pnpm install && git switch develop && cd ..
cd ami_HP   && pnpm install && git switch develop
cp .dev.vars.example .dev.vars
```

### 2.3 読んでおく文書（30分）

| 文書 | 何が書いてあるか |
|---|---|
| `ami_HP/CLAUDE.md` | このリポジトリの約束事（必読） |
| `ami_HP/README.md` | コマンドと環境変数 |
| `ami HP/docs/04_WEBSITE_CMS_INTEGRATION_RULES.md` | CMS とサイトのつなぎ方のルール（必読） |
| `ami HP/docs/projects/ami/CONTENT_CONTRACT.md` | ami のデータの項目一覧（正本） |
| `ami HP/docs/08_SITE_SETUP_AND_OPERATIONS.md` §4〜5 | CMS に項目を追加・変更する手順 |

**プロンプト（最初の1回）**

```text
このプロジェクトに初めて参加します。次の文書を読んで、公開サイト（ami_HP）と CMS（ami HP）の関係、
データの流れ（CMS → src/lib/cms → ページ → 部品）、守るべき約束事を、初心者向けに日本語で要約してください。
- ami_HP/CLAUDE.md、ami_HP/README.md、ami_HP/docs/page-development-guide.md
- ami HP/docs/04_WEBSITE_CMS_INTEGRATION_RULES.md
- ami HP/docs/projects/ami/CONTENT_CONTRACT.md
コードはまだ変更しないでください。
```

---

## 3. 毎日の起動

### 3.1 画面だけ作るとき（CMS なし）

```bash
cd ami_HP
pnpm dev          # http://localhost:4321
```

`.dev.vars` は `CMS_MODE=fixture` のままで構いません。

### 3.2 CMS とつないで確認するとき

ターミナルを2つ使います。

```bash
# ターミナル1（CMS）
cd "ami HP"
pnpm dev                                                   # http://localhost:8787

# 初めてのとき、またはデータを作り直したいときだけ
pnpm -F @ss/backend run dev:bootstrap -- --site ami --name "合同会社ami" --preset ami
# → 「Delivery API 公開キー」と「管理画面へのログインURL」が表示される（公開キーは再表示されない。必ず控える）
```

```bash
# ターミナル2（公開サイト）
cd ami_HP
pnpm seed:cms -- --token <ログインURLの token=... の部分>    # 仮データを CMS に登録・公開（新しいサイトに1回だけ）
```

`.dev.vars` を次のようにして、`pnpm dev` を起動し直します。

```text
CMS_MODE=live
CMS_BASE_URL=http://localhost:8787
CMS_SITE_KEY=ami
CMS_DELIVERY_KEY=<控えた公開キー>
```

管理画面は `pnpm -F @ss/admin dev`（http://localhost:5173）で開き、上のログインURLで入れます。

---

## 4. 1ページを作る流れ（10ステップ）

例として「ABOUT（会社紹介）ページ」を作る場合で説明します。
**ブランチは develop から切ります**（例: `feature/about-page`）。作業が終わったら develop へのプルリクエストを作ります。

```text
① デザインを読む → ② Content Map → ③ CMS に項目を定義 → ④ CMS で有効化 → ⑤ サイト側の型と取得処理
→ ⑥ 仮データ → ⑦ 画面を組む → ⑧ スマホ・動き → ⑨ デザインと比べる → ⑩ CMS とつないで確認・提出
```

### ① デザインを読む

Figma でページのフレームを選び、「リンクをコピー」します（URL に `node-id=` が入っていること）。

**プロンプト**

```text
次の Figma のフレームが〈ABOUT ページ〉のデザインです。
〈Figma の URL（node-id 付き）〉

design プラグインの Figma 接続（mcp__plugin_design_figma__*）を使って、
全体のスクリーンショットと構造（get_metadata）を取得し、セクションの一覧を作ってください。
各セクションについて「見出し・文章・画像・ボタン・装飾」を書き出し、
トップページ（src/components/sections/）で既に作った部品と共通するものがあれば指摘してください。
まだコードは変更しないでください。
```

> スマホのデザインが無い場合は、トップページと同じ考え方（PC の配置を保ちつつ縦に並べる）でサイト側が設計します。

### ② Content Map を作る（何を CMS にするか決める）

判断の基準（`docs/04` §4〜5）：

| 質問 | はい | いいえ |
|---|---|---|
| クライアントが公開後に変えたいか？ | CMS | コード |
| 件数が増えたり減ったりするか？ | Collection（一覧） | Singleton（1件だけ） |
| 見た目・余白・動き・装飾か？ | コード | ― |

**プロンプト**

```text
①で整理した〈ABOUT ページ〉のセクションについて、docs/04 §3〜§5 の基準で Content Map を作ってください。
各要素を「Global（site_info）/ Singleton / Collection / コード」に分類し、
使えそうな既存のモデル（ami HP/packages/content-schema/src/models.ts と projects/ami.ts）があれば再利用を提案してください。
新しいモデルが必要なら、key（ami_ で始める）・項目・型・必須・indexed・管理画面に出す説明文（helpText）の案を表にしてください。
結果は ami HP/docs/projects/ami/CONTENT_CONTRACT.md に追記する形の案として見せてください。まだファイルは変更しないでください。
```

→ 表を確認し、**クライアントに見せても分かる言葉** になっているか（label と helpText）をチェックしてから次へ。

### ③ CMS に項目を定義する（CMS リポジトリ）

**プロンプト**

```text
ami HP（CMS リポジトリ）で作業します。②の Content Map のとおり、
packages/content-schema/src/projects/ami.ts に〈ami_about〉を追加し、AMI_MODELS と SITE_PRESETS.ami に登録してください。
- key は ami_ で始める。後から変えない前提で決める
- 一覧の並び替え・絞り込みに使う項目だけ indexed: true
- label と helpText はクライアントが読む。専門用語を避け、推奨文字数や画像の形を書く
apps/backend/test/unit/content-schema.test.ts の「案件固有モデル: ami」に、定義が正しいことと、
仮の内容を公開時の検査（requireAll）で通せることのテストを追加してください。
docs/projects/ami/CONTENT_CONTRACT.md の Content Map と表も更新してください。
最後に pnpm typecheck と pnpm test を実行し、結果を報告してください。
```

> 既にあるモデルの **項目の削除・key の変更・型の変更** は、公開中のサイトを壊します。必ず `docs/08` §5.2 の手順で行ってください。
> 任意項目の追加・説明文の変更は安全です（`schemaVersion` を1つ上げる）。

### ④ CMS で有効化する

```bash
cd "ami HP"
pnpm -F @ss/backend run dev:bootstrap -- --site ami --name "合同会社ami" --preset ami
```

同じコマンドをもう一度実行すると、追加したモデルが有効になります（公開キーは作り直されません）。

### ⑤ サイト側の型と取得処理

データは必ず `src/lib/cms/` を通します（画面の部品から `fetch` しない）。

| ファイル | 役割 |
|---|---|
| `schemas.ts` | CMS の項目の検証（CMS の key のまま、snake_case） |
| `types.ts` | 画面で使う型（camelCase） |
| `mapper.ts` | CMS の応答 → 画面の型 |
| `queries.ts` | ページ単位の取得（例: `getAboutPageData`） |

**プロンプト**

```text
ami_HP（公開サイト）で作業します。③で CMS に追加した〈ami_about〉を、トップページと同じ作りで使えるようにしてください。
- src/lib/cms/schemas.ts に content の検証（key と型は CMS の定義と完全に一致させる。任意項目は nullable().optional()）
- src/lib/cms/types.ts に画面用の型、src/lib/cms/mapper.ts に変換（検証に失敗しても例外にせず MapError を返す）
- src/lib/cms/queries.ts に〈getAboutPageData〉（セクションごとに取得・検証し、失敗したセクションだけを欠けさせる）
- src/lib/cms/fixture-client.ts と fixtures.ts に仮データ（CMS の応答と同じ形。文言はデザインから）
- src/lib/cms/queries.test.ts にテスト（仮データで揃う、不正なエントリは報告して除外、取得失敗でもページは壊れない）
pnpm check と pnpm test を実行し、結果を報告してください。
```

### ⑥ 仮データの画像を用意する

- 画像は `public/fixtures/` に置きます（CMS に入れる写真の代わり）。
- 背景を透過した画像は、周りの透明な余白を切り落としておきます。

### ⑦ 画面を組む

使える部品（`src/components/`）：

| 部品 | 用途 |
|---|---|
| `layout/SiteHeader` `SiteFooter` `Logo` | ヘッダー・フッター（全ページ共通） |
| `ui/Decor` | 装飾のイラストを **デザインの座標のまま** 置く（`pc={[x, y, 幅]}`、`sp={[x, y, 幅]}` か `sp={false}`） |
| `ui/LocalImage` | 手元の画像（`src/assets`）を出す。astro:assets の `<Image>` は使わない |
| `ui/CmsImage` | CMS の画像を出す（width / height 付き） |
| `ui/SectionHeading` | 英字の見出し画像 |
| `ui/ViewMore` | 「View more >>」リンク |
| `../lib/url` の `withBase()` | サイト内リンクは必ずこれを通す |

**プロンプト**

```text
ami_HP で〈src/pages/about.astro〉を作ってください。デザインは〈Figma の URL〉です。
figma-design-to-code の手順に従い、design プラグインの Figma 接続で get_design_context を各セクションごとに取得し、
文字の大きさ・字間・行の高さ・色・影・角丸・枠線は Figma の値をそのまま使ってください。
- 各セクションは src/components/sections/about/ に部品として作り、データはページで getAboutPageData() を呼んで props で渡す
- 最大幅 1280px の .stage の中に組み、装飾は Decor にデザインの座標を渡す
- 画像の素材は Figma から取得し、src/assets/ に WebP で置く（PNG を置いて pnpm assets:webp）
- 英字は Pixelify Sans（var(--font-pixel)）、Topics の分類名は Krona One（var(--font-label)）、それ以外は魔導太丸ゴシック
- 色・余白は src/styles/tokens.css の値を使い、足りなければ tokens.css に追加する
- サイト内リンクは withBase() を通す。CMS の値を固定の文言で補わない（空なら出さない）
トップページ（src/pages/index.astro と src/components/sections/）の作りに合わせてください。
```

> 画面幅に比例する余白・文字サイズは `clamp(最小, (デザインの値 / 12.8)vw, デザインの値)` の形にします。
> こうすると **画面幅 1280px でちょうどデザインの値** になります。

### ⑧ スマホ・タブレット・動き

- ブレークポイント：スマホ 〜767px / タブレット 〜1023px / PC 1024px〜
- 動きは `prefers-reduced-motion`（視差効果を減らす設定）で止まるようにする（`global.css` で一括して止めている）

**プロンプト**

```text
〈about.astro〉をスマホ（375px）・タブレット（820px）・PC（1280px）・大きい画面（1440px）で確認し、崩れを直してください。
スマホではトップページと同じ考え方（文字は中央寄せ、装飾は重ならない位置に動かすか sp={false} で出さない）にしてください。
Windows の Chrome はウィンドウを 500px より狭くできないので、スマホ幅は幅 375px の iframe で撮影して確認してください。
```

### ⑨ デザインと比べる

**プロンプト**

```text
〈about.astro〉を幅 1280px で表示し、Figma のスクリーンショットと左右に並べた比較画像を作ってください。
さらにブラウザ（表示幅がちょうど 1280px になる iframe）で主な要素の位置を測り、
Figma の座標との差を表にしてください。±2px を超えるものは原因を調べて直してください。
```

### ⑩ CMS とつないで確認し、提出する

1. §3.2 の手順で `CMS_MODE=live` にする
2. 管理画面で値を変えて公開し、画面に反映されることを確認する
3. 検証を通す

```bash
cd ami_HP
pnpm check && pnpm test && pnpm build && pnpm build:pages

cd "../ami HP"            # CMS を変更した場合
pnpm typecheck && pnpm test
```

**プロンプト**

```text
〈ABOUT ページ〉の作業をまとめて提出します。
1) ami_HP と ami HP の両方で検証コマンド（CLAUDE.md に記載）をすべて実行し、結果を報告
2) 変更をブランチ〈feature/about-page〉にコミット（コミットメッセージは日本語で、何をなぜ変えたか）
3) develop へのプルリクエストを作成（本文に、変更点・確認したこと・スクリーンショット・未対応を書く）
push とプルリクエストの作成は、実行前に確認してください。
```

---

## 5. 特別な作りが必要なページ

### 5.1 記事の詳細ページ（例: TOPICS の記事 `/topics/[slug]`）

- ファイルは `src/pages/topics/[slug].astro`（URL の一部を受け取るページ）。
- `client.getEntry("ami_topics", slug)` が `null` のときは **404** を返す（`return Astro.rewrite("/404")` など）。
- 本文（`body`）は **リッチテキスト（Lexical の JSON）**。表示用の部品（RichText）が必要です。
  - 許可されているノード：段落・見出し・リスト・引用・リンク・画像など（`ami HP/packages/content-schema/src/validate.ts` の `ALLOWED_RICH_TEXT_NODES`）
  - `dangerouslySetInnerHTML`（HTML をそのまま流し込む書き方）は使わない。ノードごとに部品を割り当てる
  - 本文の中の見出しは h2 から始める（ページの h1 と重複させない）
  - 管理画面の実装 `ami HP/apps/admin/src/richtext/` が参考になる

```text
ami_HP に、CMS のリッチテキスト（Lexical JSON）を表示する src/components/ui/RichText.astro を作ってください。
docs/04 §17 に従い、許可されたノードだけをノードごとの部品で描画し、未知のノードは飛ばして reportCmsError に送ってください。
画像ノードは CmsImage、リンクは内部リンク（entry）なら withBase を通してください。テストも追加してください。
```

### 5.2 お問い合わせページ（フォーム）

- CMS の `contact` フォームを使います（項目の定義は `ami HP/packages/content-schema/src/forms.ts`）。
- **Turnstile（ボット対策）必須**、同意文の版を一緒に送る、二重送信防止、429（送りすぎ）の表示など、
  `docs/04` §21 のすべてを満たす必要があります。項目を変える場合は CMS 側の定義と同時に変えます。

### 5.3 プレビュー用ページ

- 管理画面の「プレビュー」から開く、未公開の内容を見るページです（`docs/04` §19）。
- `Cache-Control: private, no-store` と noindex、画面に「未公開」の表示を出す。

### 5.4 SEO（title / description / OGP）

- 今は `src/pages/index.astro` に仮の値があります（TODO）。
- CMS の `site_info`（既定値）→ ページごとの上書き、の順で決めます（`docs/04` §18）。最初に共通の仕組みを作ってから各ページで使ってください。

---

## 6. 守ること・やってはいけないこと

| ✅ 守ること | ❌ やってはいけないこと |
|---|---|
| データは `src/lib/cms/queries.ts` で取得し、ページから props で渡す | 部品（components）の中で `fetch` する |
| CMS の項目が空なら、その部分を出さない | `cms.title || "固定の文言"` のように黙って補う |
| サイト内リンクは `withBase()` を通す | `href="/about"` と直書きする（プレビューで壊れる） |
| 手元の画像は WebP にして `LocalImage` で出す | 大きな PNG をそのまま置く／astro:assets の `<Image>` を使う |
| フォント・背景など CSS から使うファイルは `src/assets/` に置く | `public/` に置いて `/fonts/...` と絶対パスで書く |
| 文字・色・余白は Figma の値を使う | スクリーンショットを見て目分量で決める |
| 公開キーは `.dev.vars`（Git の管理外）に置く | 公開キーをコードやコミットに入れる |
| 作業は develop から切ったブランチで行う | `main` に直接 push する（プレビューが公開される） |
| 社名は「合同会社ami」 | 「株式会社ami」と書く |

---

## 7. 困ったとき

| 症状 | 原因と対処 |
|---|---|
| CSS を直したのに画面が変わらない | 開発サーバーが古いスタイルを返すことがある。`pnpm astro dev stop` → `pnpm dev` で起動し直す |
| `seed:cms` がログインに失敗する | ログインURLの token は **1回しか使えず、15分で切れる**。`dev:bootstrap` をもう一度実行して新しい token を使う |
| 公開キーを控え忘れた | `dev:bootstrap` に `--rotate-key` を付けて作り直す（古いキーは使えなくなる） |
| CMS_MODE=live で画面が一部出ない | ターミナルのログに `[cms]` のエラーが出ている。検証に失敗した項目名が表示されるので、CMS の定義とサイト側の schemas.ts を比べる |
| Figma で「tool call limit」と出る | **View 席の Figma アカウントで接続している**。design プラグインの Figma 接続を、デザインのファイルがあるチームの Full / Dev 席のアカウントで接続し直す（`whoami` で確認） |
| スマホ幅のスクリーンショットが右で切れる | Windows の Chrome は 500px より狭くできない。幅 375px の iframe で撮る |
| 幅 1280px なのにデザインより少しずれる | スクロールバーの分、表示幅が 1265px になっている。表示幅がちょうど 1280px になる状態で測る |
| パスに空白や日本語があってコマンドが失敗する | パスを `"..."` で囲む。スクリプトでは `fileURLToPath` を使う |
| `git push` で workflow の権限エラー | `gh auth refresh -h github.com -s workflow`（有効なアカウントで実行） |

---

## 8. 提出前のチェックリスト

- [ ] Figma の値（文字・字間・行の高さ・色・影・角丸）を使っている
- [ ] 幅 1280px で、主な要素の位置がデザインと ±2px 以内
- [ ] 375px / 820px / 1440px で崩れない
- [ ] 視差効果を減らす設定で動きが止まる
- [ ] 画像に width / height がある。装飾の画像は alt="" と aria-hidden
- [ ] 見出しの順番（h1 → h2 → h3）が正しい。ページに h1 は1つ
- [ ] キーボードだけで操作できる（Tab で移動、フォーカスが見える）
- [ ] `CMS_MODE=live` で表示でき、管理画面で変えた値が反映される
- [ ] CMS の項目が空でもページが壊れない（その部分が消えるだけ）
- [ ] サイト内リンクがすべて `withBase()` を通っている（`pnpm build:pages` の結果で `/ami_HP/` 付きになっている）
- [ ] `pnpm check` / `pnpm test` / `pnpm build` / `pnpm build:pages` が通る（CMS を変えたら CMS 側の `pnpm typecheck` / `pnpm test` も）
- [ ] CONTENT_CONTRACT.md とこの手順書に、変えたこと・新しく分かったことを書いた
- [ ] 社名が「合同会社ami」になっている

---

## 9. 参考：ファイルの場所

```text
ami_HP/（公開サイト）
  src/pages/                  ページ（index.astro がトップ）
  src/components/layout/      ヘッダー・フッター・ロゴ
  src/components/sections/    セクションの部品（トップページのもの）
  src/components/ui/          共通の小さな部品（Decor / LocalImage / CmsImage / SectionHeading / ViewMore / NavMark）
  src/lib/cms/                CMS とのつなぎ（contracts / schemas / types / mapper / queries / fixtures / client）
  src/lib/url.ts              withBase()
  src/styles/tokens.css       色・余白・フォントの定義
  src/assets/                 手元の画像（WebP）・フォント
  public/fixtures/            仮データ用の画像
  scripts/                    素材の変換、ローカル CMS への仮データ登録、プレビュー用ビルド
  docs/content-model.md       トップページのデータの要約

ami HP/（CMS）
  packages/content-schema/src/projects/ami.ts   ami のモデル定義
  packages/content-schema/src/models.ts         汎用のモデル（site_info / members など）と SITE_PRESETS
  packages/content-schema/src/forms.ts          フォームの定義
  docs/projects/ami/CONTENT_CONTRACT.md         ami のデータ項目の正本
  docs/04_WEBSITE_CMS_INTEGRATION_RULES.md      サイトと CMS のつなぎ方のルール
```

---

最終更新: 2026-09-25（トップページ完成時点）。このページ以外の作り方で新しく決めたことは、この手順書に追記してください。
