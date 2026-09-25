# トップページの Content Model（案）

状態: **案**。CMS 側（`packages/content-schema/src/projects/ami.ts` と
`docs/projects/ami/CONTENT_CONTRACT.md`）に定義したら「確定」にする。

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

## 未決

- `site_info`（SEO の既定値・ロゴ・SNS の URL）の使い方。現在トップの title / description はコードの仮の値（`src/pages/index.astro` の TODO）。
- Topics・Member・Service・About・Contact の下層ページの構成（リンク先はまだ存在しない）。
