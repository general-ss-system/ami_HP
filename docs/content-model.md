# トップページの Content Model

状態: **確定（2026-09-25）**。正本は CMS リポジトリ（ami-cms）の `docs/projects/ami/CONTENT_CONTRACT.md` と
`packages/content-schema/src/projects/ami.ts`。本書はサイト側から見た要約。食い違ったら CMS 側が正しい。

サイト側の実装はこの案に合わせてある（`src/lib/cms/schemas.ts`）。key や型を変えるときは、
CMS 側 → `schemas.ts` → `mapper.ts` → UI の順に直す。

## Content Map（トップページ）

| セクション | 要素 | 持ち方 |
|---|---|---|
| ヘッダー / フッター | ナビ・ロゴ | コード（`src/config/site.ts`） |
| ヒーロー | 見出し「Where "Tokimeki" Originates.」 | コード（画像） |
| ヒーロー | 重ねて見せる写真（最大 3 枚） | CMS `ami_home.hero_images` |
| 流れる帯 | 「Where "Tokimeki" Originates.」 | コード |
| ステートメント | リード・キーワード・見出し・本文・強調語句・リンク | CMS `ami_home.statement_*` |
| Our Business | 事業（名前・説明・画像・リンク） | CMS `ami_services` |
| Topics | 記事カード（分類・サムネイル・タイトル・抜粋） | CMS `ami_topics`（件数は `ami_home.topics_limit`） |
| Member | 名前・役職・画像 | CMS `members`（汎用モデル） |
| お問い合わせ | 案内文 | CMS `ami_home.contact_body` |
| お問い合わせ | ボタン・遷移先 | コード（`/contact`） |
| 装飾（惑星・星・ウサギなど） | | コード（`src/assets/decor/`） |

## Singleton: `ami_home`

| key | 型 | 必須 | 備考 |
|---|---|---|---|
| hero_images | media_list（1〜3） | ✔ | 先頭が一番手前。縦長（約 4:5）の写真 |
| statement_lead | text | | 例: 何かに強く惹かれる瞬間。 |
| statement_keywords | text | | 例: 憧れ。情熱。共鳴。熱望。 |
| statement_title | text | | 例: 「トキメキ」 |
| statement_body | long_text | ✔ | 1 行ずつ改行で区切る |
| statement_highlight | text | | 本文の中で強調する語句（例: 「トキメキの発生点」）。本文に無ければ強調しない |
| statement_link | link | | 例: View more → /about |
| topics_limit | number（1〜12） | | 未入力なら 4 |
| contact_body | long_text | | 改行あり |

## Collection: `ami_services`（Our Business）

| key | 型 | 必須 | indexed | 備考 |
|---|---|---|---|---|
| title | text | ✔ | ✔ | |
| summary | long_text | | | |
| image | media | | | **背景を透過し、周りの透明な余白を切り落とした PNG**（縦長）。枠の高さの 110%・幅の 92% に収めて下揃えで置くので、縦長ほど枠の上に大きくはみ出す |
| link | link | | | |
| sort_order | number | | ✔ | 昇順で並べる |

## Collection: `ami_topics`（Topics）

| key | 型 | 必須 | indexed | 備考 |
|---|---|---|---|---|
| title | text | ✔ | ✔ | |
| category | select（news / sns / column） | ✔ | ✔ | カードの色とラベルが変わる |
| thumbnail | media | | | 横長（約 3:2） |
| excerpt | long_text | | | カードでは 3 行で切る |
| published_date | date | ✔ | ✔ | 降順で並べる |
| body | rich_text | | | 詳細ページ用（トップでは使わない） |

slug あり。カードのリンク先は `/topics/{slug}`。

## Collection: `members`（汎用モデルを使う）

| key | 型 | 必須 | indexed | 備考 |
|---|---|---|---|---|
| name | text | ✔ | ✔ | |
| role | text | | | 例: CEO / Influencer |
| portrait | media | | | 正方形に近い画像（231:218） |
| profile | long_text | | | 詳細ページ用 |
| sort_order | number | | ✔ | 昇順。トップでは先頭 6 件 |

## 下層ページ（2026-09-26 追加）

デザインが無いため、トップのデザインに合わせてこのリポジトリで組んだ。モデルは CMS の汎用モデル
（`site_info` / `about` / `contact_page` / `members`）の key をそのまま使い、案件モデルには本文などを足した。
CMS 側の定義（`packages/content-schema`）は 2026-09-27 にこのサイトの key に合わせた（下の「CMS の定義との対応」）。

| ページ | URL | 使うデータ |
|---|---|---|
| ABOUT | `/about` | `ami_home.statement_*`（トップと同じステートメント）、`about`、`site_info` |
| SERVICE | `/service`（各事業は `#slug`） | `ami_services`（`body` を追加） |
| MEMBER | `/member`（各メンバーは `#slug`） | `members`（`profile`） |
| TOPICS 一覧 | `/topics`、`/topics/page/{n}`、`/topics/category/{news|sns|column}` | `ami_topics`（12 件ずつ） |
| TOPICS 詳細 | `/topics/{slug}` | `ami_topics`（`body`・`external_url` を追加）。`external_url` がある記事は詳細を作らずカードから直接開く |
| CONTACT | `/contact` | `contact_page`、フォーム `ami_contact`（Form API の定義） |
| RECRUIT | `/recruit`（各職種は `#slug`） | `recruit`（メッセージ・職場写真）、`job_positions`（`is_open` が false の職種は出さない）。応募は CONTACT へ |
| FAQ | `/faq` | `faq`（表示順の昇順。質問を押すと回答が開く）|
| PRIVACY POLICY | `/privacy` | `contact_page.privacy_note`（CONTACT のフォームに出す文章と同じ）。フッターからリンク |
| WORKS 一覧 | `/works`、`/works/page/{n}`、`/works/tag/{branding|web|graphic|movie}` | `works`（CMS の汎用モデル。12 件ずつ・公開日の新しい順） |
| WORKS 詳細 | `/works/{slug}` | `works`（概要・本文・ギャラリー・外部リンク） |
| sitemap.xml / robots.txt | `/sitemap.xml`、`/robots.txt` | 固定のページ（トップ・フッターのナビ）＋ `ami_topics`（外部リンクの記事を除く）・`works` の詳細（`src/lib/sitemap.ts`）。GitHub Pages のプレビューの robots.txt はすべて拒否 |
| 404 | — | — |

### 追加・利用する項目

| モデル | key | 型 | 使い方 |
|---|---|---|---|
| `ami_services` | body | rich_text | SERVICE の本文 |
| `ami_topics` | body | rich_text | 詳細の本文 |
| `ami_topics` | external_url | link | 設定するとカードから直接この URL を開く |
| `members` | profile | long_text | MEMBER の紹介文（改行あり） |
| `works` | title（必須）/ client_name / summary / published_date / tags（multi_select）/ thumbnail / gallery / body / external_url | | CMS の汎用モデルそのまま。タグの表示名は `src/lib/works.ts`（CMS の選択肢の label と同じ） |
| `site_info` | company_name（必須）/ address / phone / email / instagram_url / x_url / default_title / title_template / default_description / default_og_image | | 会社概要の表（電話番号・メールも）、フッターの SNS（http(s) の URL だけ）、トップの `<title>`・description（`default_*`）、下層ページの `<title>`（`title_template` の `%s` にページ名）、OGP 画像の既定値（記事・実績はサムネイルを優先） |
| `about` | lead / body（rich_text）/ main_image / representative / established / capital / business_summary | | ABOUT のメッセージと会社概要の表。空の行は出さない |
| `contact_page` | lead / privacy_note（rich_text）/ consent_label | | CONTACT の案内文・個人情報の取り扱い・同意チェックの文言 |

rich_text は `src/lib/cms/richtext.ts` で許可したノードだけを描画する（段落・見出し・リスト・引用・コード・画像・区切り線・リンク）。
リンクは http(s) / mailto / tel / サイト内パスのみ。本文の h1 は h2 に下げる。

### お問い合わせフォーム

- 入力欄は `GET /api/v1/forms/{siteKey}/ami_contact` の定義から組み立てる（項目を増やすときは CMS のフォーム定義だけを直す）。
- 送信はブラウザから Form API へ直接行う（CMS が送信者の IP でレート制限・Turnstile の検証をするため）。
  処理は `src/lib/cms/form-submit.ts`、画面は `src/components/contact/ContactForm.astro`（入力 → 確認 → 完了）。
- 同意文の版（`consentTextVersion`）を一緒に送る。古い版で 400 が返ったら、再読み込みを促す。
- `PUBLIC_TURNSTILE_SITE_KEY`（公開してよい値）が必要。**ビルド時に埋め込まれる**ので、本番のビルド環境に設定する。
  CMS 側では、サイトの許可オリジン（`allowedOrigins`）に公開ドメインを登録する。
- `CMS_MODE=fixture`（GitHub Pages のプレビューを含む）では送信せずに完了まで進める（画面に「プレビュー用」と出る）。
- フォームを出せないとき（定義を取れない・受付停止中・同意文が空）は、受け付けていない旨だけを出し、エラーを記録する。

## WORKS を CMS で使えるようにする

`works` は CMS の汎用モデルだが、ami のひな形（`preset: "ami"`）には入っていない。live で使う前に、
制作側（platform_admin）がサイトで `works` を有効にする（`POST /api/v1/admin/sites/{siteId}/models`）。
ヘッダーのナビはデザインの 4 項目のままにし、WORKS へはフッター・SERVICE ページからリンクする。

## RECRUIT を CMS で使えるようにする

`recruit` / `job_positions` / `faq` も CMS の汎用モデルで、ami のひな形には入っていない。live で使う前に、WORKS と同じく
制作側がサイトで有効にする。有効でない間は、RECRUIT ページはメッセージを出さず「現在、募集している職種はありません。」と出す。
フッターからリンクする（ヘッダーのナビには足さない）。

## 下書きプレビュー（ADR-028 / CMS docs/04 §19）

CMS の管理画面の「プレビュー」から、公開前の内容を本番と同じ見た目で確認できる。

1. 管理画面がサイト設定の「プレビュー用URL」を新しいタブで開く。登録する URL:
   `https://<公開ドメイン>/api/preview?token={token}&model={model}&slug={slug}&entryId={entryId}`
   （`PATCH /api/v1/admin/sites/{siteId}/preview-url`、platform_admin）
2. `/api/preview`（`src/preview/enter.ts`）がトークンを Preview API で確かめ、httpOnly Cookie（1 時間）に移して該当ページへ送る。
   行き先はモデルごとに `src/lib/cms/preview.ts` の `resolvePreviewPath` で決める（ページを増やしたら足す）。
3. `src/middleware.ts` が Cookie を読み、ページは `getCmsClient(Astro.locals)` で Preview API（下書き）を読む。
   応答は `private, no-store`・`noindex`。画面の上に「未公開の下書きを表示しています」の帯と「プレビューを終了」を出す。
4. トークンが切れたら（Preview API が 401）Cookie を消し、管理画面から開き直すよう案内する。

- `/api/preview`・`/api/preview-exit` は SSR のときだけ登録する（`astro.config.mjs`）。GitHub Pages のプレビュー（静的書き出し）には無い。
- `CMS_MODE=fixture` ではプレビューできない（503 で案内する）。
- `CMS_MODE` / `CMS_BASE_URL` / `CMS_SITE_KEY` / `PUBLIC_TURNSTILE_SITE_KEY` は**ビルド時に埋め込まれる**
  （Cloudflare のアダプタは `wrangler.jsonc` の `vars` と `.dev.vars` から読む）。live に切り替えるときはビルドし直す。
  `CMS_DELIVERY_KEY` だけは実行時に読む（`wrangler secret`）。

## 下層ページのデザイン（2026-09-27 追加）

Figma「株式会社ami ホームページデザイン」（`j89x4NQBPwr9L2SbxVGYjY`）の下層ページ（service / member / topics / topics-2 / contact）に合わせて作り直した。
デザインの SVG と、要素ごとの CSV は `design/`（README を参照）。

次の項目・モデルを足した（CMS 側の定義にも同じ key で入っている。CMS の commit `a5564da`）。

| モデル | key | 型 | 使い方 |
|---|---|---|---|
| `ami_topics` | pickup | boolean（indexed） | TOPICS 一覧の「Pick UP!」に出す（新しい順に 5 件まで） |
| `members` | birthday | date | MEMBER のプロフィール（1998/06/12 の形で出す） |
| `members` | hometown / height / mbti / personal_color | short_text | 同上（出身・身長・MBTI・パーソナルカラー） |
| `members` | instagram_url / x_url / tiktok_url | link | label にアカウント名（@…）、href に URL。http(s) の URL だけ出す |
| `members` | photos | media_list（最大 4） | 証明写真の台紙に 2×2 で並べる |
| `ami_services` | title_en | short_text | 英語の添え書き（Product development など） |
| `ami_services` | photo | media | SERVICE ページの写真（横長 393:298） |
| `ami_services` | accent | select（pink / blue） | パネルの色。未入力なら並び順で交互 |
| `ami_service_page`（singleton・新規） | lead | long_text | SERVICE の地球の下の案内文（改行で行を分ける） |
| `ami_service_cases`（collection・新規） | service | relation → ami_services | どの事業の Case Study か |
| 〃 | label / title（必須） | short_text | 小見出し（コスメブランド / 自社メディア …）と名前 |
| 〃 | main_image | media | あると「商品」の並び（写真が左・下に写真の一覧 5 枚）、無いと「メディア」の並び（写真が右に 2×2、1 枚なら大きく） |
| 〃 | body / points | rich_text | 本文と、実績など（points は h3 ごとに区切り、✦ の小見出しにする。1 つ目は全幅、2 つ目から 2 列） |
| 〃 | instagram_url / x_url / tiktok_url | link | members と同じ |
| 〃 | pricing | long_text | 料金の表。1 行に「項目\|値\|注記」（注記は省略可）。区切りの無い行は文のまま表の幅いっぱいに出す（例: ご相談ください） |
| 〃 | gallery | media_list | 写真 |
| 〃 | sort_order | number（indexed） | 昇順 |

- `contact_page.consent_label` の「プライバシーポリシー」の部分は、プライバシーポリシーのページへのリンクにする（無ければ文の後ろにリンクを添える）。
  CONTACT のフォームには、個人情報の取り扱いの文章（`privacy_note`）を出さない（`/privacy` に出す）。
- お問い合わせフォームの入力例（例）山田太郎 など）は、CMS のフォーム定義の `helpText`。入力欄の薄い文字は項目名から作る。
- SERVICE の事業の並びは `ami_services.sort_order`（トップの Our Business と同じ）。デザインでは商品開発が 01。
- ヘッダーのナビは 4 項目のまま（service / contact のデザインには CONTACT があるが、topics / member のデザインには無い）。

## CMS の定義との対応（2026-09-27）

CMS の `projects/ami.ts` は初期の試作（`apps/ami-hp-main`）に合わせた key だったため、このサイトの key に揃えた
（`ami_home` v2: hero_images / statement_* / contact_body、`ami_services` v2: link / title_en / photo / accent、
`ami_topics` v2: pickup、`members` v2: プロフィール、新規 `ami_service_page` / `ami_service_cases`、preset "ami" に works / recruit / job_positions / faq）。
SNS の key は、CMS が 1 文字の key（x）を許さないため `instagram_url` / `x_url` / `tiktok_url`（site_info と同じ形）にした。

ローカルの CMS で確かめたこと（`pnpm seed:cms` で仮データを全ページ分登録 → `CMS_MODE=live`）:

- 全ページが CMS のデータ・画像で表示される（仮データの画像は使われない）。CMS の検証で落ちる項目は無い
- 管理画面の API で SERVICE の案内文を書き換えて公開すると、次のリクエストでページに出る
- CMS 側の backend のテストのうち 3 件（ログインが要る HTTP のテスト）は、この変更の前から失敗している

## 見出し画像の修正（2026-09-27）

素材の Topics の英字見出しが「Tpics」（o が無い）だったため、p の丸い部分を o として T と p の間に足し、ステッカーを横に伸ばした（幅 433 → 523px、表示幅 212 → 256px）。

## 未決


- 会社情報・代表メッセージ・個人情報の取り扱いの実際の文言（仮データは「〇〇（仮）」）。
- お問い合わせの通知先（CMS の管理画面で設定）。
