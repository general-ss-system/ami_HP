/**
 * 本番の設定（deploy/production.json）の検証と、下書きプレビュー用 Worker の wrangler 設定の生成。
 *
 * 本番の構成（CMS docs/05 ADR-031）:
 * - 公開サイト … Xserver に静的な HTML を置く（siteHost）。ビルドのときに CMS から読む。
 * - 下書きプレビュー … このサイトのコードを SSR で動かす Worker（workers.dev・noindex）。
 *   CMS の Webhook（公開・非公開など）もこの Worker が受け、GitHub Actions の再ビルドを起動する。
 *
 * 開発用の wrangler.jsonc は書き換えず、案件の値を差し込んだ設定を別ファイルに書き出してビルドに渡す。
 * scripts/deploy.mjs から Node で直接読み込むため、このファイルは他のモジュールを import しない。
 */

export interface ProductionConfig {
  /** 公開サイトのホスト名（例: www.example.co.jp）。canonical・OGP・sitemap の絶対URLに使う。 */
  readonly siteHost: string;
  /** CMS の URL（例: https://ami-cms.example.workers.dev）。 */
  readonly cmsBaseUrl: string;
  /** CMS のサイトキー（ami）。 */
  readonly cmsSiteKey: string;
  /** Turnstile のサイトキー（公開してよい値）。ビルド時に埋め込まれる。 */
  readonly turnstileSiteKey: string;
  /** 下書きプレビュー用の Worker。 */
  readonly preview: {
    readonly workerName: string;
    /** Cloudflare のアカウントID（32桁の16進）。省略時は環境変数 CLOUDFLARE_ACCOUNT_ID。 */
    readonly accountId?: string;
    /** <workerName>.<アカウントのサブドメイン>.workers.dev */
    readonly host: string;
    /** CMS の Webhook を受けたときに再ビルドを起動するリポジトリ（owner/name）。 */
    readonly githubRepo: string;
  };
  /**
   * 公開サイトの置き場所（Xserver の SSH）。秘密鍵は書かない（GitHub の Secret か手元の ssh-agent）。
   * 決まるまでは省略できる（下書きプレビュー用 Worker だけ先に出す）。アップロードには必須。
   */
  readonly xserver?: {
    /** 例: sv12345.xserver.jp */
    readonly host: string;
    /** Xserver の SSH は 10022。 */
    readonly port: number;
    /** サーバーID */
    readonly user: string;
    /** 置き場所の絶対パス（例: /home/<サーバーID>/<ドメイン>/public_html）。 */
    readonly path: string;
  };
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const ACCOUNT_ID = /^[0-9a-f]{32}$/;
const WORKER_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SITE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GITHUB_REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const UNIX_USER = /^[a-z_][a-z0-9_-]{0,31}$/;
// 共同利用のサーバなので、置き場所はホームの下に限る。空白・..・引用符を通さない（ssh のコマンドに渡すため）。
const REMOTE_PATH = /^\/home\/[a-z_][a-z0-9_-]*(?:\/[A-Za-z0-9._-]+)+$/;

/** 誤りの一覧を返す（空なら正しい）。 */
export function validateProductionConfig(input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return ["本番設定が JSON のオブジェクトではありません"];
  const d = input as Record<string, unknown>;
  const at = (path: string, ok: boolean, reason: string) => {
    if (!ok) errors.push(`${path}: ${reason}`);
  };
  const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;

  at("siteHost", str(d.siteHost) && HOSTNAME.test(d.siteHost), "公開サイトのホスト名（例: www.example.co.jp）。https:// やパスは付けない");
  at("cmsBaseUrl", str(d.cmsBaseUrl) && isCmsOrigin(d.cmsBaseUrl), "CMS の URL（例: https://ami-cms.example.workers.dev）。末尾のスラッシュ・パスは付けない");
  at("cmsSiteKey", str(d.cmsSiteKey) && SITE_KEY.test(d.cmsSiteKey), "CMS のサイトキー（ami）");
  at("turnstileSiteKey", str(d.turnstileSiteKey) && /^[0-9A-Za-z_-]{10,}$/.test(d.turnstileSiteKey), "Turnstile のサイトキー（Cloudflare の Turnstile の画面で発行）");

  const p = (d.preview ?? {}) as Record<string, unknown>;
  at("preview.workerName", str(p.workerName) && WORKER_NAME.test(p.workerName), "英小文字・数字・ハイフン（例: ami-hp-preview）");
  at(
    "preview.accountId",
    p.accountId === undefined || p.accountId === "" || (str(p.accountId) && ACCOUNT_ID.test(p.accountId)),
    "Cloudflare のアカウントID（32桁）。省略時は環境変数 CLOUDFLARE_ACCOUNT_ID",
  );
  at(
    "preview.host",
    str(p.host) && HOSTNAME.test(p.host) && p.host.endsWith(".workers.dev") && p.host.split(".").length === 4 && p.host.startsWith(`${String(p.workerName)}.`),
    "<workerName>.<アカウントのサブドメイン>.workers.dev",
  );
  at("preview.githubRepo", str(p.githubRepo) && GITHUB_REPO.test(p.githubRepo), "このリポジトリ（owner/name）");

  if (d.xserver === undefined) return errors;
  const x = (d.xserver ?? {}) as Record<string, unknown>;
  at("xserver.host", str(x.host) && HOSTNAME.test(x.host), "Xserver のホスト名（例: sv12345.xserver.jp）");
  at("xserver.port", Number.isInteger(x.port) && (x.port as number) > 0 && (x.port as number) < 65536, "SSH のポート（Xserver は 10022）");
  at("xserver.user", str(x.user) && UNIX_USER.test(x.user), "サーバーID");
  at(
    "xserver.path",
    str(x.path) && REMOTE_PATH.test(x.path) && !x.path.split("/").includes("..") && x.path.startsWith(`/home/${String(x.user)}/`),
    "置き場所の絶対パス（例: /home/<サーバーID>/<ドメイン>/public_html）。末尾のスラッシュは付けない",
  );
  return errors;
}

/** https の origin。手元の CMS で試すときだけ http://localhost を許す（本番の公開キーを平文で送らない）。 */
function isCmsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.origin !== value) return false;
    if (url.protocol === "http:") return url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return url.protocol === "https:" && HOSTNAME.test(url.hostname);
  } catch {
    return false;
  }
}

/** 開発用の wrangler 設定に案件の値を差し込んだ、下書きプレビュー用 Worker の設定を返す（元のオブジェクトは変えない）。 */
export function renderPreviewWranglerConfig(base: Record<string, unknown>, d: ProductionConfig): Record<string, unknown> {
  const errors = validateProductionConfig(d);
  if (errors.length > 0) throw new Error(`本番設定に誤りがあります:\n- ${errors.join("\n- ")}`);

  const config: Record<string, unknown> = structuredClone(base);
  delete config.$schema;
  delete config.routes;
  config.name = d.preview.workerName;
  if (d.preview.accountId) config.account_id = d.preview.accountId;
  // DNS を Cloudflare に置かない構成なので workers.dev で公開する（ADR-031）。プレビューURL（版ごとのURL）は閉じる。
  config.workers_dev = true;
  config.preview_urls = false;
  config.vars = {
    ...(base.vars as Record<string, unknown> | undefined),
    CMS_MODE: "live",
    CMS_BASE_URL: d.cmsBaseUrl,
    CMS_SITE_KEY: d.cmsSiteKey,
    GITHUB_REPO: d.preview.githubRepo,
  };
  return config;
}

/** wrangler.jsonc（コメント・末尾カンマ付きの JSON）を読める JSON にする。文字列の中の // はコメントとして扱わない。 */
export function stripJsonc(text: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}
