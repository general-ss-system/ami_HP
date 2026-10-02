import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderPreviewWranglerConfig, stripJsonc, validateProductionConfig, type ProductionConfig } from "./production-config";

const valid: ProductionConfig = {
  siteHost: "www.example.co.jp",
  cmsBaseUrl: "https://ami-cms.example.workers.dev",
  cmsSiteKey: "ami",
  turnstileSiteKey: "0x4AAAAAAAexample",
  preview: {
    workerName: "ami-hp-preview",
    accountId: "0123456789abcdef0123456789abcdef",
    host: "ami-hp-preview.example.workers.dev",
    githubRepo: "example-org/ami_HP",
  },
  xserver: {
    host: "sv12345.xserver.jp",
    port: 10022,
    user: "xsvuser",
    path: "/home/xsvuser/example.co.jp/public_html",
  },
};

const fields = (errors: string[]) => errors.map((e) => e.split(":")[0]);

describe("validateProductionConfig", () => {
  it("見本（deploy/production.example.json）は形式として正しい", () => {
    const example = JSON.parse(readFileSync(new URL("../../../deploy/production.example.json", import.meta.url), "utf8"));
    expect(validateProductionConfig(example)).toEqual([]);
  });

  it("URL・ホスト名の書き方の誤りを指摘する", () => {
    const errors = validateProductionConfig({
      ...valid,
      siteHost: "https://www.example.co.jp/",
      cmsBaseUrl: "https://ami-cms.example.workers.dev/",
      cmsSiteKey: "",
      turnstileSiteKey: "",
    });
    expect(fields(errors)).toEqual(["siteHost", "cmsBaseUrl", "cmsSiteKey", "turnstileSiteKey"]);
  });

  it("CMS が http のままの設定は受け付けない（本番の公開キーを平文で送らない）。手元の CMS だけは許す", () => {
    expect(validateProductionConfig({ ...valid, cmsBaseUrl: "http://cms.example.co.jp" })).toHaveLength(1);
    expect(validateProductionConfig({ ...valid, cmsBaseUrl: "http://localhost:8787" })).toEqual([]);
  });

  it("下書きプレビューは <workerName>.<サブドメイン>.workers.dev に限る", () => {
    expect(fields(validateProductionConfig({ ...valid, preview: { ...valid.preview, host: "preview.example.co.jp" } }))).toEqual(["preview.host"]);
    expect(fields(validateProductionConfig({ ...valid, preview: { ...valid.preview, host: "other.example.workers.dev" } }))).toEqual(["preview.host"]);
    expect(fields(validateProductionConfig({ ...valid, preview: { ...valid.preview, githubRepo: "ami_HP" } }))).toEqual(["preview.githubRepo"]);
  });

  it("Xserver の置き場所はサーバーIDのホームの下の絶対パスに限る（共同利用のサーバで他の場所に触れない）", () => {
    const withPath = (path: string) => fields(validateProductionConfig({ ...valid, xserver: { ...valid.xserver, path } }));
    expect(withPath("/home/xsvuser/example.co.jp/public_html")).toEqual([]);
    expect(withPath("/home/xsvuser/example.co.jp/public_html/")).toEqual(["xserver.path"]);
    expect(withPath("/home/other/example.co.jp/public_html")).toEqual(["xserver.path"]);
    expect(withPath("/home/xsvuser/../other/public_html")).toEqual(["xserver.path"]);
    expect(withPath("/home/xsvuser/example.co.jp/public html")).toEqual(["xserver.path"]);
    expect(withPath("/home/xsvuser/x';rm -rf ~;'")).toEqual(["xserver.path"]);
    expect(withPath("/var/www")).toEqual(["xserver.path"]);
  });

  it("Xserver の項目が無ければ指摘する", () => {
    const { xserver: _omit, ...rest } = valid;
    expect(fields(validateProductionConfig(rest))).toEqual(["xserver.host", "xserver.port", "xserver.user", "xserver.path"]);
  });
});

describe("renderPreviewWranglerConfig", () => {
  const base = JSON.parse(stripJsonc(readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8")));

  it("案件の値を差し込み、workers.dev で公開する（版ごとのプレビューURLは閉じる）", () => {
    const rendered = renderPreviewWranglerConfig(base, valid);
    expect(rendered.name).toBe("ami-hp-preview");
    expect(rendered.account_id).toBe(valid.preview.accountId);
    expect(rendered.workers_dev).toBe(true);
    expect(rendered.preview_urls).toBe(false);
    expect(rendered.routes).toBeUndefined();
    expect(rendered.vars).toEqual({
      CMS_MODE: "live",
      CMS_BASE_URL: "https://ami-cms.example.workers.dev",
      CMS_SITE_KEY: "ami",
      GITHUB_REPO: "example-org/ami_HP",
    });
    // 開発用の設定（互換日付・静的ファイル）は引き継ぐ
    expect(rendered.compatibility_date).toBe(base.compatibility_date);
    expect(rendered.assets).toEqual(base.assets);
    expect(rendered.$schema).toBeUndefined();
  });

  it("公開キーなどの Secret を設定ファイルに書かない", () => {
    expect(JSON.stringify(renderPreviewWranglerConfig(base, valid))).not.toMatch(/ssdk_|DELIVERY_KEY|WEBHOOK_SECRET|DISPATCH_TOKEN/);
  });
});

describe("stripJsonc", () => {
  it("コメントと末尾カンマを取り除き、文字列の中の // は残す", () => {
    const text = '{\n  // コメント\n  "url": "https://example.com", /* 範囲 */\n  "list": [1, 2,],\n}';
    expect(JSON.parse(stripJsonc(text))).toEqual({ url: "https://example.com", list: [1, 2] });
  });
});
