# デザインの資料

Figma「株式会社ami ホームページデザイン」（`j89x4NQBPwr9L2SbxVGYjY`）の下層ページを SVG で書き出したものから作った資料。

- 元の SVG はリポジトリの直下（`service.svg` / `member.svg` / `topics.svg` / `topics-2.svg` / `contact.svg`）に置く。大きいのでコミットしない（`.gitignore`）。
- `csv/<ページ>.csv` … 要素ごとの位置・大きさ・色・線・角丸・不透明度・影（`pnpm design:csv *.svg`）。
  - 座標は 1280px 幅のページ全体での値（transform を反映済み）。
  - Figma の書き出しでは文字が輪郭になるため、文字は「テキストレイヤー 1 つ = path 1 つ」として色と外接矩形だけが分かる。書体・字間・行の高さは SVG に残らない。
  - `shadow` は `dx dy blur spread color`（drop-shadow）。`kind` の `text?` は文字らしい細長い単色の path。
  - 背景の星（小さい点）も 1 行ずつ出る。見たい範囲は y と大きさで絞り込む。

| ページ | SVG | 高さ |
|---|---|---|
| SERVICE | service.svg | 5476 |
| MEMBER | member.svg | 7254 |
| TOPICS 一覧 | topics.svg | 7254 |
| TOPICS 詳細 | topics-2.svg | 7254 |
| CONTACT | contact.svg | 5476 |

## 部品を取り出す

- `node scripts/design-extract.mjs <svg> <行番号の範囲> <出力.webp>` … CSV の行番号の図形だけを残して画像にする。
  元の SVG の構造（グループの transform・filter・mask）をそのまま使うので、Figma の「外側の線」や影も同じに描ける。
  例: 下層ページのドット絵のタイトル `src/assets/headings/title-*.webp`、Pick UP! のラベル、アイコン。
- `node scripts/design-element.mjs <svg> <行番号...>` … 要素の元の属性（path の d など）を表示する。
  角がドットの形の枠（`src/assets/shapes/`）は、この d をそのまま使い、viewBox を要素の外接矩形にしている。
- 装飾（惑星・星など）の画像は、デザインでは 1254px 四方の画像を枠に入れている。`src/assets/decor/` の素材も同じ余白を含むので、
  デザインの枠の [x, y, 幅] をそのまま `Decor` の `pc` に渡せる。
