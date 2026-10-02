/**
 * 本番の設定（deploy/production.json）の検証と、公開用の wrangler 設定の生成。
 *
 * 開発用の wrangler.jsonc は書き換えず、案件の値を差し込んだ設定を別ファイルに書き出して
 * ビルドに渡す（CMS の provision と同じ考え方。CMS docs/09 §4）。
 * scripts/deploy.mjs から Node で直接読み込むため、このファイルは他のモジュールを import しない。
 */

export interface ProductionConfig {
  /** Worker の名前（例: ami-hp）。 */
  readonly workerName: string;
  /** Cloudflare のアカウントID（32桁の16進）。省略時は環境変数 CLOUDFLARE_ACCOUNT_ID。 */
  readonly accountId?: string;
  /** 公開サイトのホスト名（例: www.example.co.jp）。ここだけで公開する（*.workers.dev は無効にする）。 */
  readonly siteHost: string;
  /** CMS の URL（例: https://cms.example.co.jp）。 */
  readonly cmsBaseUrl: string;
  /** CMS のサイトキー（ami）。 */
  readonly cmsSiteKey: string;
  /** Turnstile のサイトキー（公開してよい値）。ビルド時に埋め込まれる。 */
  readonly turnstileSiteKey: string;
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const ACCOUNT_ID = /^[0-9a-f]{32}$/;
const WORKER_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SITE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 誤りの一覧を返す（空なら正しい）。 */
export function validateProductionConfig(input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return ["本番設定が JSON のオブジェクトではありません"];
  const d = input as Record<string, unknown>;
  const at = (path: string, ok: boolean, reason: string) => {
    if (!ok) errors.push(`${path}: ${reason}`);
  };
  const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;

  at("workerName", str(d.workerName) && WORKER_NAME.test(d.workerName), "英小文字・数字・ハイフン（例: ami-hp）");
  at(
    "accountId",
    d.accountId === undefined || d.accountId === "" || (str(d.accountId) && ACCOUNT_ID.test(d.accountId)),
    "Cloudflare のアカウントID（32桁）。省略時は環境変数 CLOUDFLARE_ACCOUNT_ID",
  );
  at("siteHost", str(d.siteHost) && HOSTNAME.test(d.siteHost), "公開サイトのホスト名（例: www.example.co.jp）。https:// やパスは付けない");
  at("cmsBaseUrl", str(d.cmsBaseUrl) && isHttpsOrigin(d.cmsBaseUrl), "CMS の URL（例: https://cms.example.co.jp）。末尾のスラッシュ・パスは付けない");
  at("cmsSiteKey", str(d.cmsSiteKey) && SITE_KEY.test(d.cmsSiteKey), "CMS のサイトキー（ami）");
  at("turnstileSiteKey", str(d.turnstileSiteKey) && /^[0-9A-Za-z_-]{10,}$/.test(d.turnstileSiteKey), "Turnstile のサイトキー（Cloudflare の Turnstile の画面で発行）");
  return errors;
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && HOSTNAME.test(url.hostname) && url.origin === value;
  } catch {
    return false;
  }
}

/** 開発用の wrangler 設定に案件の値を差し込んだ、公開用の設定を返す（元のオブジェクトは変えない）。 */
export function renderWranglerConfig(base: Record<string, unknown>, d: ProductionConfig): Record<string, unknown> {
  const errors = validateProductionConfig(d);
  if (errors.length > 0) throw new Error(`本番設定に誤りがあります:\n- ${errors.join("\n- ")}`);

  const config: Record<string, unknown> = structuredClone(base);
  delete config.$schema;
  config.name = d.workerName;
  if (d.accountId) config.account_id = d.accountId;
  // 公開するのは本番のホスト名だけ。*.workers.dev やプレビューURLからは開けないようにする。
  config.workers_dev = false;
  config.preview_urls = false;
  config.routes = [{ pattern: d.siteHost, custom_domain: true }];
  config.vars = {
    ...(base.vars as Record<string, unknown> | undefined),
    CMS_MODE: "live",
    CMS_BASE_URL: d.cmsBaseUrl,
    CMS_SITE_KEY: d.cmsSiteKey,
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
