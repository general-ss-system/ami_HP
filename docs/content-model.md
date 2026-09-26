# トップページの Content Model

状態: **確定（2026-09-25）**。正本は CMS リポジトリの `docs/projects/ami/CONTENT_CONTRACT.md` と
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
**CMS 側（`packages/content-schema`）にまだ無い項目は、CMS 側に足してから live で使う。**

| ページ | URL | 使うデータ |
|---|---|---|
| ABOUT | `/about` | `ami_home.statement_*`（トップと同じステートメント）、`about`、`site_info` |
| SERVICE | `/service`（各事業は `#slug`） | `ami_services`（`body` を追加） |
| MEMBER | `/member`（各メンバーは `#slug`） | `members`（`profile`） |
| TOPICS 一覧 | `/topics`、`/topics/page/{n}`、`/topics/category/{news|sns|column}` | `ami_topics`（12 件ずつ） |
| TOPICS 詳細 | `/topics/{slug}` | `ami_topics`（`body`・`external_url` を追加）。`external_url` がある記事は詳細を作らずカードから直接開く |
| CONTACT | `/contact` | `contact_page`、フォーム `ami_contact`（Form API の定義） |
| 404 | — | — |

### 追加・利用する項目

| モデル | key | 型 | 使い方 |
|---|---|---|---|
| `ami_services` | body | rich_text | SERVICE の本文 |
| `ami_topics` | body | rich_text | 詳細の本文 |
| `ami_topics` | external_url | link | 設定するとカードから直接この URL を開く |
| `members` | profile | long_text | MEMBER の紹介文（改行あり） |
| `site_info` | company_name（必須）/ address / default_title / title_template / default_description / default_og_image | | 会社概要の表、下層ページの `<title>`（`title_template` の `%s` にページ名） |
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

## 未決

- トップの title / description はまだコードの仮の値（`src/pages/index.astro` の TODO）。下層ページは `site_info` から解決している。
- 会社情報・代表メッセージ・個人情報の取り扱いの実際の文言（仮データは「〇〇（仮）」）。
- お問い合わせの通知先（CMS の管理画面で設定）。
