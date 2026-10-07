# 本番の構築とデプロイ

公開サイト（このリポジトリ）と CMS（ami-cms）を本番に置く手順。構成の決定は ami-cms の `docs/05_TECH_DECISIONS.md` ADR-031、
CMS 側の詳しい手順・権限・引き継ぎは ami-cms の `docs/09_DELIVERY_AND_HANDOVER.md`。

## 1. 構成

ドメインは Xserver で管理し、同じドメインで Google Workspace（メール）を使っている。**DNS（ネームサーバ）には触れない。**

```text
Xserver（先方と共同利用のレンタルサーバ）
└ https://www.<ドメイン>   公開サイト。静的な HTML・画像（このリポジトリを pnpm release build で書き出したもの）

先方の Cloudflare アカウント（Workers Free。独自ドメイン・ゾーンは使わない）
├ https://ami-cms.<サブドメイン>.workers.dev          管理画面 + API（ami-cms）
├ https://ami-hp-preview.<サブドメイン>.workers.dev   下書きプレビュー + CMS の Webhook の受け口（このリポジトリを SSR で動かす。noindex）
├ D1・R2・Queues・Durable Objects（CMS が使う）
└ Turnstile（お問い合わせのボット対策。ドメインの登録だけで DNS は変えない）

GitHub（このリポジトリ）
└ Actions: CMS の公開 → 静的にビルド → SSH で Xserver に置く
```

### 公開の反映の流れ

```text
管理画面で公開・非公開・アーカイブ・削除（予約公開を含む）
  → CMS の Webhook（署名付き）→ 下書きプレビュー用 Worker の /api/cms-webhook（署名を確かめる）
  → GitHub の repository_dispatch（cms-publish）→ Actions の site ジョブ
  → pnpm release build（CMS の公開中の内容を読み、CMS の画像を /media/ に取り込む）
  → pnpm release upload（rsync で Xserver へ）
```

- 反映まで**数分**かかる（先方了承済み）。公開が続いた場合、ビルドは「実行中1件＋待ち1件」にまとまる。
- 画像はビルドのときに取り込んで Xserver から配信する。公開サイトの閲覧は Cloudflare を通らず、CMS が止まってもサイトは表示される。
- お問い合わせはブラウザから CMS の Form API に直接送る（CMS の許可オリジンに `https://www.<ドメイン>` を入れる）。
- 画像の差し替え（同じメディアの置き換え）だけでは Webhook が出ない。すぐ反映したいときは Actions の Deploy を手動で実行する（§6）。

## 2. 無料プラン（Workers Free）で動かすときの注意

機能はすべて無料プランで動く。上限を超えると**課金ではなく、エラーになる**。
公開サイトの閲覧は Xserver なので数に入らない。数に入るのは管理画面・ビルド・下書きプレビュー・お問い合わせの送信だけ。

| 上限 | 内容 | 確認のしかた |
|---|---|---|
| CPU 10ms / 1回のアクセス | 超えたアクセスはエラー（1102）。下書きプレビューのページの組み立てと、CMS の長い本文の保存が重い | Cloudflare の Workers の画面の「CPU 時間」、または `wrangler tail` |
| 10万リクエスト / 日 | アカウント全体。1回のビルドで CMS へ数十リクエスト | Workers の画面の「リクエスト数」 |
| DB の巻き戻し（Time Travel）7日分 | Paid は30日。障害から戻せる期間が短い | ami-cms の docs/08 §10 |
| 外部への通信 50回 / 1回の処理 | CMS の配送処理。お問い合わせが十数秒に数十件届いたときだけ当たりうる（失敗は後で再送される） | CMS の管理画面「配送状況」 |

GitHub Actions は非公開リポジトリだと無料枠（月 2,000 分、Organization のプランによる）を使う。1回のビルドで 2〜3 分。

## 3. 先方に用意してもらうもの

1. Cloudflare アカウント（共有のメールで作り、2段階認証を有効にする）。Workers の画面で workers.dev のサブドメインを決める
2. 自社の担当者を Cloudflare のメンバーに招待（Workers・D1・R2・Queues。管理者にはしない）
3. Turnstile のウィジェット（ホスト名に `www.<ドメイン>` と `<ドメイン>`）→ サイトキー
4. Resend のアカウント。送信用ドメインはサブドメイン（例: `mail.<ドメイン>`）にし、認証レコードを **Xserver の DNS 設定に追加**する（Google Workspace のレコードは変えない）
5. Xserver の SSH を有効にし、デプロイ用の公開鍵を登録する（§4.3）。「国外IPアクセス制限」が SSH に掛かっていないか確認する（GitHub Actions は国外から接続する）
6. Xserver で公開サイトを置くディレクトリ（`/home/<サーバーID>/<ドメイン>/public_html` など）。先方の既存ファイルがあるかを確認する

## 4. 構築の順番

CMS を先に作る（サイトが読む先と、サイトに渡す公開キーができるため）。

### 4.1 CMS（ami-cms）

```bash
cd ami-cms/apps/backend
pnpm exec wrangler login                         # 招待されたアカウントで（作業後は wrangler logout）
cp deploy/production.example.json deploy/production.json   # accountId・adminHost（workers.dev）・mail.from を入れる
pnpm provision check
pnpm provision resources --yes
pnpm provision migrate --yes
pnpm provision deploy --yes
pnpm exec wrangler secret put SESSION_SECRET --config wrangler.production.json   # ほか ami-cms docs/09 §6 の表のすべて
pnpm provision secrets
pnpm provision init-site --yes \
  --admin-email <制作側の担当者> --owner-email <先方のオーナー> \
  --site-key ami --site-name "合同会社ami" --preset ami --forms ami_contact \
  --origins https://www.<ドメイン> --domain www.<ドメイン> \
  --preview-url "https://ami-hp-preview.<サブドメイン>.workers.dev/api/preview?token={token}&model={model}&slug={slug}&entryId={entryId}"
```

`init-site` が表示する**公開キー（ssdk_…）は一度しか表示されない**。4.2・4.4 でそのまま登録する（ファイル・チャットに残さない）。

### 4.2 本番設定（このリポジトリ）

```bash
cp deploy/production.example.json deploy/production.json
# siteHost・cmsBaseUrl・turnstileSiteKey・preview（workerName・accountId・host・githubRepo）・xserver（host・port・user・path）を入れる
pnpm release check     # 検証して wrangler.production.json を書き出す（どこにも触れない）
```

`deploy/production.json` は Secret を含まないのでコミットする（Actions が使う）。

### 4.3 Xserver の SSH 鍵

デプロイ専用の鍵を作り、公開鍵を Xserver に、秘密鍵を GitHub の Secret に置く。

```bash
ssh-keygen -t ed25519 -N "" -C "ami-hp-deploy" -f ami-hp-deploy     # 作業用のフォルダで
# ami-hp-deploy.pub を Xserver のサーバーパネル「SSH設定 → 公開鍵登録・更新」に登録
ssh-keyscan -p 10022 sv12345.xserver.jp                            # 出力（ホスト鍵）を確かめる
```

- GitHub の Secrets（production 環境）: `XSERVER_SSH_KEY` = `ami-hp-deploy` の中身、`XSERVER_KNOWN_HOSTS` = `ssh-keyscan` の出力。
- 登録したら手元の秘密鍵は消す（必要になれば作り直して差し替える）。

### 4.4 下書きプレビュー用 Worker

```bash
pnpm release preview-deploy --yes
pnpm exec wrangler secret put CMS_DELIVERY_KEY --name ami-hp-preview        # 4.1 の公開キー
pnpm exec wrangler secret put CMS_WEBHOOK_SECRET --name ami-hp-preview      # 4.5 で表示される署名鍵（whsec_…）
pnpm exec wrangler secret put GITHUB_DISPATCH_TOKEN --name ami-hp-preview   # 下の GitHub のトークン
```

- `GITHUB_DISPATCH_TOKEN` は GitHub の Fine-grained personal access token（対象はこのリポジトリだけ・権限は **Contents: Read and write** だけ・有効期限付き）。
  納品後は先方の Organization の担当者のトークンに差し替える。
- Secret は一度登録すれば、以後のデプロイでは消えない。

### 4.5 CMS の Webhook

CMS の管理画面（platform_admin）で Webhook を登録する。

- 送信先: `https://ami-hp-preview.<サブドメイン>.workers.dev/api/cms-webhook`
- イベント: 公開（content.published）・非公開（content.unpublished）・アーカイブ（content.archived）・削除（content.deleted）
- 表示された署名鍵を 4.4 の `CMS_WEBHOOK_SECRET` に入れる

### 4.6 GitHub の設定と初回の公開

- Variables: `DEPLOY_ENABLED` = `true`（**公開する時に入れる**。下記）
- Environments: `production`（**承認者は設定しない**。CMS の公開で自動で動くため）
- Secrets（production 環境）: `CMS_DELIVERY_KEY`・`XSERVER_SSH_KEY`・`XSERVER_KNOWN_HOSTS`・`CLOUDFLARE_DEPLOY_TOKEN`（Workers のスクリプトの編集）・`CLOUDFLARE_ACCOUNT_ID`
- 公開の前に、Actions の Deploy を **rehearsal にチェックを入れて** 手動で実行する。`DEPLOY_ENABLED` を入れる前でも動き、
  CMS の公開中の内容でビルドし、Xserver に接続して置くファイルを数える（Xserver には何も書かない。`pnpm release upload --yes --dry-run`）
- 公開するとき: `DEPLOY_ENABLED` = `true` を入れてから、Actions の Deploy を手動で実行する（初回の公開。ビルドから表示まで数分）。
  入れた時点から、CMS での公開・main への push のたびに Xserver へ反映される

### 4.7 確認

- [ ] `https://www.<ドメイン>` の全ページが CMS の内容で表示され、画像が `/media/` から配信されている
- [ ] 管理画面で公開した変更が、数分でサイトに反映される（Actions の Deploy が `repository_dispatch` で動く）
- [ ] 管理画面の「配送状況」で Webhook が成功している
- [ ] 管理画面の「プレビュー」で下書きが見える（トップページ・トピックス）。プレビューの URL は検索に載らない（noindex・robots.txt）
- [ ] お問い合わせが送れて、管理画面の受信一覧に届き、通知メールが来る
- [ ] 存在しない URL で 404 ページが出る（`.htaccess`）
- [ ] Workers の画面で、CMS とプレビュー用 Worker の CPU 時間がおおむね 10ms 未満（§2）

## 5. Xserver に置くもの

- `pnpm release build` が `dist/` に書き出したもの（HTML・`/_astro/`・`/media/`・`.htaccess`・`sitemap.xml`・`robots.txt`）。
- 置いたファイルの一覧を `.ami-hp-manifest` として一緒に置く。次回のアップロードでは、**この一覧にあって新しいビルドに無いものだけ**を消す。
  rsync の `--delete` は使わないので、同じディレクトリにある先方のファイルには触れない。
- `.htaccess` はビルドのたびに上書きする。Xserver 側で独自の設定（リダイレクトなど）が要る場合は、`src/lib/deploy/static-media.ts` の `apacheConfig()` に足す。

## 6. 2回目以降

| きっかけ | 動くもの |
|---|---|
| 管理画面で公開・非公開など | site（ビルド → Xserver） |
| `main` への push | site と preview-worker（型チェック・テストのあと） |
| Actions の Deploy を手動で実行 | site と preview-worker |

手元から出す場合（Mac・Linux・WSL。rsync と ssh が要る）:

```bash
CMS_DELIVERY_KEY=ssdk_... pnpm release deploy --yes    # ビルドして Xserver に置く
pnpm release preview-deploy --yes                      # 下書きプレビュー用 Worker
```

（GitHub Pages のプレビューは別。リポジトリを private に戻すと止まる）

## 7. 将来 DNS を Cloudflare に移す場合

CMS は ami-cms の `adminHost` を独自ドメインにして再デプロイするだけで移れる（ADR-031）。
公開サイトを Workers の SSR に戻す場合は、このリポジトリの `BUILD_TARGET` に Workers 用の設定を足す（2026-10-02 の `bdb401e` に以前の仕組みがある）。
