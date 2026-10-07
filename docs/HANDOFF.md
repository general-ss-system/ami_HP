# 引き継ぎメモ（2026-10-07 時点）

別のデバイスで作業を続けるための、現状のまとめ。手順の決まりごとは `CLAUDE.md`、CMS の項目は `docs/content-model.md`、
本番の構築とデプロイは `docs/deploy.md` が正本。

## 1. リポジトリ・ブランチ・本番の構成

| リポジトリ | ブランチ | 内容 |
|---|---|---|
| `general-ss-system/ami_HP`（このリポジトリ・今は public） | `develop`（作業）/ `main` | 公開サイト。`main` への push で GitHub Pages のプレビューが更新される |
| `general-ss-system/ami-cms`（非公開） | `develop`（作業）/ `main` | ami 専用の管理画面・API。`main` への push で CI（テスト）が動く |

- 2026-10-07 時点: `develop` と `main` は両方とも同じ内容で push 済み（10-05 の変更・公開サイトのファビコンまで）。
- 本番の構成（ami-cms ADR-031）: **DNS（Xserverビジネス・Google Workspace）には触れない**。
  - 公開サイト … Xserver（先方と共同利用）に静的な HTML（未公開。`www.ami.tokyo.jp` は今は Xserver の初期ページ）
  - CMS（管理画面 + API）… 先方の Cloudflare の workers.dev: **https://ami-cms.ami-cms.workers.dev**
  - 下書きプレビュー・先方確認用のサイト … **https://ami-hp-preview.ami-cms.workers.dev**（noindex。SSR）
  - 公開の反映 … CMS の Webhook → `/api/cms-webhook` → GitHub Actions で再ビルド → Xserver（Webhook は未登録）
- Cloudflare: 先方アカウント（info@ami.tokyo.jp）。workers.dev のサブドメイン `ami-cms`。**Workers Free**（一般公開の前に Paid を先方と決める）。
  このPCの wrangler は先方アカウントでログイン中（作業が終わったら `wrangler logout`）。
- 納品時は ami_HP と ami-cms を先方の GitHub の Organization へ移す（ami-cms の docs/09 の形C）。

## 2. できていること

### サイト（ami_HP）
- トップ・下層ページ一式（ABOUT / SERVICE / MEMBER / TOPICS（一覧・分類・詳細）/ CONTACT / PRIVACY POLICY / 404、sitemap.xml・robots.txt）。
  WORKS / RECRUIT / FAQ も作ってあるが、今回の要件外のため**非表示**（下記）
- 下層ページは新しい Figma（`j89x4NQBPwr9L2SbxVGYjY`）どおり。公開前の点検（`CLAUDE.md`「公開前の点検」）も実施済み
- 9/29〜30: BudouX による文節での改行、背景の流れ星、Pick UP! の自動送り、下層ページの背景
- 本番の仕組み（`docs/deploy.md`）: `pnpm release build|upload|deploy|preview-deploy`、`.github/workflows/deploy.yml`、
  CMS の画像の取り込み、Xserver への rsync（manifest で自分が置いたファイルだけ消す）、Webhook の受け口（署名の検証）
- 10/05: 料金の表で「|」の無い行（「ご相談ください」など）も表示する
- 10/05: **WORKS・RECRUIT・FAQ の表示・非表示を CMS の管理画面で切り替える**（`src/config/pages.ts`・ami-cms ADR-035）。
  非表示は 404・フッター・サイトマップから除外。静的書き出しでは目印ファイルを `scripts/lib/remove-hidden-pages.mjs` が取り除く

### CMS（ami-cms）
- 本番を先方の Cloudflare に構築済み: D1・Workers KV（画像の一時保存先）・Queues・Turnstile（ウィジェット「ami お問い合わせ」）
- **画像は R2 ではなく Workers KV に一時保存**（ADR-032）。R2 の有効化（支払い方法の登録）を先方確認の後に打診するため
- 仮データ投入済み（`pnpm seed:cms --allow-remote`）。先方はこの内容を見ながら差し替える
- メール（Resend）: 送信ドメイン **notify.ami.tokyo.jp**（`mail.` は Google Workspace が使用中のため回避）、送信元 noreply@notify.ami.tokyo.jp。
  ログインメール・お問い合わせ通知の到着を確認（SPF/DKIM/DMARC すべて PASS）
- ログインできるのは登録済みの人だけ: general@shortstop.co.jp（制作側の管理者）・info@ami.tokyo.jp（ami のオーナー）。
  未登録のアドレスはログイン画面でその旨を表示（ADR-034）
- お問い合わせの通知メールに入力内容を載せる（ami_contact だけ / ADR-033）。管理画面へのリンクも載せる
- 管理画面: 左上・ログイン画面・ファビコンを ami のロゴに。サイト設定に「ページの表示設定」、非表示のメニューに「非公開」の印
- 直した不具合: 本番でメールが送れない（fetch の呼び方）、本番のログアウトが 500（Cookie の属性）、main への push で CI が動かない

## 3. 残っていること

### 先方の確認・判断
- [x] 先方に管理画面と確認用サイトを共有した（10-07 までに案内文を送信済み）。操作感・デザインの確認の返事待ち
- [ ] **R2 の有効化**（Cloudflare で支払い方法を登録。無料枠 10GB の範囲なら請求なし）
  → こちらで `pnpm -F @ss/backend provision media-to-r2 --yes` → `provision deploy --yes`（画像の URL・内容は変わらない）
- [ ] **Workers Paid（月 $5〜）にするか**: 確認用サイト（プレビュー用 Worker）は CPU が無料プランの上限 10ms を超えがち（中央値 13ms・最大 62ms）。
  今はエラーは出ていないが、1102 エラーの恐れ。CMS 側は問題なし。公開サイト（Xserver）は無関係
- [ ] 原稿の差し替え（仮データのまま）: ABOUT・CONTACT の会社概要、MEMBER の名前、TOPICS の記事、PRIVACY POLICY の本文
  （WORKS・RECRUIT・FAQ は非表示なので後回しでよい）
- [ ] プライバシーポリシーに「お問い合わせ内容は外部のメール送信サービス（米国）を通る」旨を書く（ADR-033）
- [ ] お問い合わせの通知先（管理画面で設定。共有の窓口アドレス推奨）
- [ ] 通知メールが迷惑メールに入る対策: Google Workspace の管理者が「承認済み送信者」に `notify.ami.tokyo.jp` を登録
- [ ] （任意）ami.tokyo.jp 本体の SPF（`v=spf1 include:_spf.google.com ~all`）と DMARC
- [ ] Cloudflare・Resend の 2 段階認証（先方が最後に設定すると決めた。納品前に必ず確認）
- [ ] 公開ドメインは `www.ami.tokyo.jp` と推測して設定した（CMS の許可オリジン・Turnstile）。違えば直す

### 公開サイトの本番公開（`docs/deploy.md` §4.2〜§4.7）
- [ ] 先方（Xserverビジネスの管理パネル）: SSH を有効化・デプロイ用の公開鍵を登録・国外IPアクセス制限の確認・公開ディレクトリの確認
- [ ] こちら:
  1. デプロイ用の SSH 鍵を作る（§4.3）
  2. `deploy/production.json` に `xserver`（host・port・user・path）を足す → `pnpm release check`
  3. 管理画面で、ビルド用の公開キーを新しく発行する（前のキーはプレビュー用 Worker にだけ登録してあり、手元に無い）
  4. GitHub（ami_HP）の Secret（`CMS_DELIVERY_KEY`・`XSERVER_SSH_KEY`・`XSERVER_KNOWN_HOSTS`・`CLOUDFLARE_DEPLOY_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`）、
     `production` 環境（承認者なし）、変数 `DEPLOY_ENABLED=true`
  5. プレビュー用 Worker に `CMS_WEBHOOK_SECRET`・`GITHUB_DISPATCH_TOKEN` を登録し、管理画面で Webhook を登録（`/api/cms-webhook`）
  6. Actions の Deploy を手動で実行 → §4.7 のチェックリストで確認
- [ ] 公開前に ami_HP を private に戻すか決める（戻すと GitHub Pages のプレビューは止まる）
- [x] 10-05 の変更を `main` に取り込む（10-07）
- [ ] （任意）CMS の自動デプロイ（ami-cms の GitHub に Cloudflare のトークン・`DEPLOY_ENABLED`）
- [x] 公開サイトのファビコンを ami のロゴマークに（10-07。管理画面と同じ画像を `public/` に置いた）

### 納品（ami-cms の docs/09）
- [ ] 両リポジトリを先方の GitHub の Organization へ移す
- [ ] `GITHUB_DISPATCH_TOKEN` を先方の担当者のトークンに差し替える
- [ ] 権限の整理（自社の担当者の Cloudflare 権限・このPCの `wrangler logout`・CMS の制作側管理者の扱い）
- [ ] 基盤ソースの権利（譲渡か利用許諾か / docs/09 §12）

### 決めたこと（変える場合は相談）
- 社名は「合同会社ami」。ヘッダーのナビは 4 項目（ABOUT・SERVICE・MEMBER・TOPICS）
- WORKS・RECRUIT・FAQ は今回の要件外のため非表示（10-05）。管理画面「サイト設定 > ページの表示設定」で切り替える。
  ヘッダーのページ・トップ・CONTACT・PRIVACY POLICY は常に表示
- SERVICE の事業の順番は CMS の `sort_order`。お問い合わせは「入力 → 確認 → 送信」
- 料金の表は「項目|値|注記」。区切りの無い行は文のまま表の幅いっぱいに出す

## 4. CMS の定義（ami 固有のモデル）

`packages/content-schema/src/projects/ami.ts`（詳細は `docs/content-model.md`、ami-cms の `docs/projects/ami/CONTENT_CONTRACT.md`）。

- `ami_home` / `ami_services` / `ami_topics` / `ami_service_page` / `ami_service_cases`、
  10-05 追加の `ami_page_visibility`（show_works / show_recruit / show_faq。サイドバーには出さずサイト設定で扱う）
- 汎用モデル `site_info` / `about` / `members` / `contact_page` / `works` / `recruit` / `job_positions` / `faq` を preset `ami` に含める
- フォーム `ami_contact`（name・company・email・message。通知メールに内容を載せる）

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
本番の CMS の操作は ami-cms の `apps/backend` で `pnpm provision …`（ログイン用 URL の発行は `provision login-link --email … --yes`）。

## 6. つまずいたところ（同じ失敗をしないために）

- **`.stage` に左右の padding を付けない**（cqw が内容の幅基準になり、飾りの位置が 1200/1280 にずれる）。左右の余白は中身に付ける
- Astro はコンポーネントを import した時点で CSS を束ねる。`is:global` の `body { … }` は、そのコンポーネントを出さないページにも効く
- scoped の CSS は属性の分だけ詳細度が高い。ページ側から上書きするより、レイアウトに prop を足す（例: `heroMinHeightSp`）
- **astro:env の public なサーバー変数はビルド時に埋め込まれる**（wrangler の vars は効かない）。プレビュー用 Worker のビルドに CMS の接続先を渡すこと
- Astro は `dist/` を空にしない。種類の違うビルドを続けると前の成果物が混ざる（`scripts/deploy.mjs` は先に消す）
- **ami.tokyo.jp の DNS の正本は Xserverビジネス**（ns*.xbiz.ne.jp）。Xserverドメインの DNS 画面（xdomain）は参照されていない
- `mail.ami.tokyo.jp` は Google Workspace（Gmail）の CNAME。メール送信には `notify.` を使う
- Resend の DMARC の表示は `_dmarc`（ドメイン全体）。送信用サブドメインだけにするなら `_dmarc.notify`
- `!` でターミナルの入力を求めるコマンド（`wrangler secret put` など）を実行すると、空の値が登録される。自分のターミナルで実行する
- Workers の `fetch` はオブジェクトのメソッドとして呼ぶと Illegal invocation（`this.fetchFn(...)` は不可）
- Hono で `__Host-` の Cookie を消すときは Secure・Path=/ を付ける（付けないと例外 → 500）
- ami-cms の作業コピーは改行が CRLF。置換のスクリプトは `\r\n` を `\n` にしてから照合する
- Git Bash では引数の `/ami_HP/` が Windows のパスに変換される → `MSYS_NO_PATHCONV=1`
- PowerShell 5.1 からネイティブのコマンドに `""` を含む文字列を渡すと壊れる（commit メッセージはファイルか heredoc で渡す）
- OneDrive の下では `git stash -u` や `git worktree remove` がファイルを消せないことがある（Permission denied）
- CMS の `dev:bootstrap` は実行のたびに公開キーを発行し直す。ログインの token は 1 回しか使えない
- ヘッドレスの Chrome の `--window-size` には最小の幅がある。スマホ幅の確認は DevTools Protocol の `Emulation.setDeviceMetricsOverride`
- Figma MCP は View 席だと呼び出し回数の上限がある
