# 引き継ぎメモ（2026-09-29 時点）

別のデバイスで作業を続けるための、現状のまとめ。手順の決まりごとは `CLAUDE.md`、CMS の項目は `docs/content-model.md` が正本。

## 1. リポジトリとブランチ

| リポジトリ | ブランチ | 内容 |
|---|---|---|
| `ami_HP`（このリポジトリ） | `main` | 公開サイト。push すると GitHub Pages のプレビューが更新される |
| 〃 | `develop` | `main` をマージ済み ＋ このメモ（`main` には無い `docs/page-development-guide.md` もある） |
| `SS-HP-PUBLIC-SYSTEM`（CMS） | `develop` | ami のモデル定義をこのサイトに合わせた変更を含む（下の 4.） |
| 〃 | `main` | **origin には未 push**（ローカルに 3 commit 先行。`develop` にはマージ済み） |

- プレビュー: https://general-ss-system.github.io/ami_HP/ （`main` への push で更新。仮データ・静的書き出し）
- 別デバイスでは `develop` を取り込んでから作業する。`main` へ戻すときは `develop` → `main` をマージする。

## 2. できていること

- トップ・下層ページ一式: ABOUT / SERVICE / MEMBER / TOPICS（一覧・分類・詳細）/ WORKS / RECRUIT / FAQ / CONTACT / PRIVACY POLICY / 404、sitemap.xml・robots.txt
- 下層ページ（SERVICE / MEMBER / TOPICS / TOPICS 詳細 / CONTACT）は新しい Figma（`j89x4NQBPwr9L2SbxVGYjY`）どおりに作り直し済み。
  主な要素はデザインの座標と ±3px 前後（SNS の事例カードの高さなど、中身の量で変わるところを除く）
- デザインの資料: `design/csv/*.csv`（要素ごとの位置・大きさ・色・影）、部品を取り出す道具 `scripts/design-extract.mjs` ほか（`design/README.md`）。
  元の SVG（`service.svg` など、リポジトリ直下）は大きいのでコミットしていない → **別デバイスで使うなら SVG を手で持っていく**
- CMS 連携: `CMS_MODE=live` で全ページが CMS のデータで表示され、管理画面での変更が反映されることをローカルの CMS で確認済み
- 公開前の点検（画像の width/height・alt・見出しの順・キーボード操作・動きを減らす設定・空の項目・375/820/1440）を実施済み（`CLAUDE.md`「公開前の点検」）

## 3. 残っていること（決めること・やること）

- [ ] CMS リポジトリの `main` を push するか（`develop` には入っている）
- [ ] 本番ドメイン（`astro.config.mjs` の `site` が仮の `https://www.example.com`）。canonical・OGP・sitemap に使う
- [ ] 本番の `PUBLIC_TURNSTILE_SITE_KEY`（お問い合わせのボット対策。ビルド時に埋め込まれる）と `CMS_DELIVERY_KEY`（`wrangler secret`）
- [ ] 原稿: 会社情報・代表メッセージ・プライバシーポリシー・採用・FAQ・事例などは「（仮）」の仮データ
- [ ] お問い合わせの通知先（CMS の管理画面で設定）
- [ ] 本番の CMS でサイトを作るとき、preset `ami` とフォーム `ami_contact` を有効にする（`docs/projects/ami/CONTENT_CONTRACT.md` の立ち上げ設定）
- 決めたこと（変える場合は相談）:
  - 社名は「合同会社ami」
  - ヘッダーのナビは 4 項目（service / contact のデザインには CONTACT があるが、topics / member のデザインには無い）
  - SERVICE の事業の順番は CMS の `sort_order`（トップと同じ。デザインでは商品開発が 01）
  - お問い合わせは「入力 → 確認 → 送信」の流れを残した（デザインは入力画面のみ）
- CMS 側の既知の問題: backend のテストのうち 3 件（ログインが要る HTTP のテスト。form-admin の CSV 2 件・outbox の Webhook 1 件）は、今回の変更の前から失敗している
- `SS-HP-PUBLIC-SYSTEM/apps/ami-hp-main` は初期の試作で、公開サイトには使わない（key も古い）

## 4. CMS の定義（2026-09-27〜28 の変更）

CMS の `packages/content-schema/src/projects/ami.ts` をこのサイトの key に合わせた（詳細は `docs/content-model.md`「CMS の定義との対応」）。

- `ami_home` v2（hero_images / statement_* / contact_body）、`ami_services` v2（link / title_en / photo / accent）、`ami_topics` v2（pickup）
- 新規 `ami_service_page`（SERVICE の案内文）・`ami_service_cases`（Case Study。`service` は ami_services への relation）
- `members` v2（birthday / hometown / height / mbti / personal_color / instagram_url / x_url / tiktok_url / photos）
- SNS の key は `*_url`（CMS は 1 文字の key を許さない）
- preset `ami` に works / recruit / job_positions / faq と新しいモデルを含める。フォーム `ami_contact` の各項目に入力例（helpText）

## 5. 別デバイスでの始め方

```bash
git clone <ami_HP の URL> && cd ami_HP && git switch develop
corepack enable   # pnpm が PATH に無い場合は、以下を corepack pnpm で
pnpm install
cp .dev.vars.example .dev.vars   # 既定は CMS_MODE=fixture（仮データ）
pnpm dev                         # http://localhost:4321
pnpm check && pnpm test && pnpm build && pnpm build:pages   # 完了の前に必ず
```

ローカルの CMS で live を確かめる手順は `CLAUDE.md` §6（`dev:bootstrap -- --site ami` → `pnpm seed:cms -- --token …` → `.dev.vars` を live に）。

## 6. つまずいたところ（同じ失敗をしないために）

- **`.stage` に左右の padding を付けない**（cqw が内容の幅基準になり、飾りの位置が 1200/1280 にずれる）。左右の余白は中身に付ける
- Astro はコンポーネントを import した時点で CSS を束ねる。`is:global` の `body { … }` は、そのコンポーネントを出さないページにも効く（下書きのバナーで全ページが 44px ずれていた → `:has()` で絞った）
- scoped の CSS は属性の分だけ詳細度が高い。ページ側から上書きするより、レイアウトに prop を足す（例: `heroMinHeightSp`）
- Git Bash では引数の `/ami_HP/` が Windows のパスに変換される → `MSYS_NO_PATHCONV=1`
- PowerShell 5.1 からネイティブのコマンドに `""` を含む文字列を渡すと壊れる（commit メッセージはファイルか heredoc で渡す）
- OneDrive の下では `git stash -u` や `git worktree remove` がファイルを消せないことがある（Permission denied）
- CMS の `dev:bootstrap` は実行のたびに公開キーを発行し直す。ログインの token は 1 回しか使えない
- ヘッドレスの Chrome の `--window-size` には最小の幅がある。スマホ幅の確認・撮影は DevTools Protocol の `Emulation.setDeviceMetricsOverride` を使う
- Figma MCP は View 席だと呼び出し回数の上限がある（今回は途中で上限に達し、SVG の書き出しに切り替えた）
