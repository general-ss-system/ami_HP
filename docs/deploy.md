# 本番の構築とデプロイ

公開サイト（このリポジトリ）と CMS（ami-cms）を、**先方名義の Cloudflare** に置く手順。
CMS 側の詳しい手順・権限・引き継ぎは ami-cms の `docs/09_DELIVERY_AND_HANDOVER.md`。

## 1. 構成

```text
先方の Cloudflare アカウント（Workers Free で構築。一般公開の前に Paid にするかを先方と決める）
├ www.<ドメイン>   公開サイト（このリポジトリ / Worker: ami-hp）
├ cms.<ドメイン>   管理画面 + API（ami-cms / Worker: ami-cms）
├ D1・R2・Queues・Durable Objects（CMS が使う）
└ Turnstile（お問い合わせのボット対策）
```

サイトはページを開くたびに CMS から内容を読む（SSR）。CMS で公開した変更は、サイトの再デプロイなしで反映される。

## 2. 無料プラン（Workers Free）で動かすときの注意

機能はすべて無料プランで動く。上限を超えると**課金ではなく、エラーになる**。

| 上限 | 内容 | 確認のしかた |
|---|---|---|
| CPU 10ms / 1回のアクセス | 超えたアクセスはエラー（1102）。サイトのページの組み立てと、CMS の長い本文の保存が重い | Cloudflare の Workers の画面の「CPU 時間」、または `wrangler tail` |
| 10万リクエスト / 日 | サイトと CMS の合計（アカウント全体）。超えるとその日はエラー | Workers の画面の「リクエスト数」 |
| キャッシュの削除 5回 / 分 | CMS はまとめて削除するので通常は当たらない | CMS の管理画面「配送状況」 |
| DB の巻き戻し（Time Travel）7日分 | Paid は30日。障害から戻せる期間が短い | ami-cms の docs/08 §10 |
| 外部への通信 50回 / 1回の処理 | CMS の配送処理。お問い合わせが十数秒に数十件届いたときだけ当たりうる（失敗は後で再送される） | 同上 |

一般公開の前に、上の数値を確認して先方と Paid（月 $5 程度）への切り替えを決める。設定やコードの変更は要らない。

## 3. 先方に用意してもらうもの

1. Cloudflare アカウント（共有のメールで作り、2段階認証を有効にする）
2. ドメイン（Cloudflare で購入するか、ネームサーバを Cloudflare に向ける）
3. 自社の担当者を Cloudflare のメンバーに招待（Workers・D1・R2・Queues・対象ゾーンの DNS / Workers Routes。管理者にはしない）
4. Turnstile のウィジェット（サイトのドメインで作成）→ サイトキー
5. Resend のアカウントと送信用ドメインの認証
6. API トークン（Cache Purge だけ・対象ゾーンだけ）→ 値は当日に Cloudflare へ直接登録する

## 4. 構築の順番

CMS を先に作る（サイトが読む先と、サイトに渡す公開キーができるため）。

### 4.1 CMS（ami-cms）

```bash
cd ami-cms/apps/backend
pnpm exec wrangler login                         # 招待されたアカウントで（作業後は wrangler logout）
cp deploy/production.example.json deploy/production.json   # accountId・adminHost・zoneId・mail.from を入れる
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
  --preview-url "https://www.<ドメイン>/api/preview?token={token}&model={model}&slug={slug}&entryId={entryId}"
```

`init-site` が表示する**公開キー（ssdk_…）は一度しか表示されない**。4.2 でそのまま登録する（ファイル・チャットに残さない）。

### 4.2 公開サイト（このリポジトリ）

```bash
cp deploy/production.example.json deploy/production.json   # accountId・siteHost・cmsBaseUrl・turnstileSiteKey を入れる
pnpm release check                # 検証して wrangler.production.json を書き出す（Cloudflare には触れない）
pnpm release deploy --yes         # 本番の値でビルドしてデプロイ
pnpm exec wrangler secret put CMS_DELIVERY_KEY --name ami-hp   # 4.1 の公開キー（初回だけ。以後のデプロイでは消えない）
```

- `pnpm release` はビルドの間だけ `.dev.vars` を退避する（開発用の値・テスト用の Turnstile キーが本番に混ざらないため）。
- `deploy/production.json` は Secret を含まないのでコミットする（自動デプロイが使う）。

### 4.3 確認

- [ ] `https://www.<ドメイン>` の全ページが CMS の内容で表示される。`*.workers.dev` では開けない
- [ ] 管理画面で公開した変更が、1分以内にサイトに反映される
- [ ] 管理画面の「プレビュー」で下書きが見える（トップページ・トピックス）
- [ ] お問い合わせが送れて、管理画面の受信一覧に届き、通知メールが来る
- [ ] Workers の画面で、サイトと CMS の CPU 時間がおおむね 10ms 未満（§2）

## 5. 2回目以降のデプロイ

`main` への push で GitHub Actions（`.github/workflows/deploy.yml`）がデプロイする。
リポジトリの Settings で `DEPLOY_ENABLED`・`production` 環境・`CLOUDFLARE_DEPLOY_TOKEN`・`CLOUDFLARE_ACCOUNT_ID` を設定するまでは動かない。
（GitHub Pages のプレビューは別。リポジトリを private に戻すと止まる）
