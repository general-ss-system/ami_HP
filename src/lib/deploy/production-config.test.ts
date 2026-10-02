import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderWranglerConfig, stripJsonc, validateProductionConfig, type ProductionConfig } from "./production-config";

const valid: ProductionConfig = {
  workerName: "ami-hp",
  accountId: "0123456789abcdef0123456789abcdef",
  siteHost: "www.example.co.jp",
  cmsBaseUrl: "https://cms.example.co.jp",
  cmsSiteKey: "ami",
  turnstileSiteKey: "0x4AAAAAAAexample",
};

describe("validateProductionConfig", () => {
  it("見本（deploy/production.example.json）は形式として正しい", () => {
    const example = JSON.parse(readFileSync(new URL("../../../deploy/production.example.json", import.meta.url), "utf8"));
    expect(validateProductionConfig(example)).toEqual([]);
  });

  it("URL・ホスト名の書き方の誤りを指摘する", () => {
    const errors = validateProductionConfig({
      ...valid,
      siteHost: "https://www.example.co.jp/",
      cmsBaseUrl: "https://cms.example.co.jp/",
      cmsSiteKey: "",
      turnstileSiteKey: "",
    });
    expect(errors.map((e) => e.split(":")[0])).toEqual(["siteHost", "cmsBaseUrl", "cmsSiteKey", "turnstileSiteKey"]);
  });

  it("CMS が http のままの設定は受け付けない（本番の公開キーを平文で送らない）", () => {
    expect(validateProductionConfig({ ...valid, cmsBaseUrl: "http://cms.example.co.jp" })).toHaveLength(1);
  });
});

describe("renderWranglerConfig", () => {
  const base = JSON.parse(stripJsonc(readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8")));

  it("案件の値を差し込み、本番のホスト名だけで公開する", () => {
    const rendered = renderWranglerConfig(base, valid);
    expect(rendered.name).toBe("ami-hp");
    expect(rendered.account_id).toBe(valid.accountId);
    expect(rendered.workers_dev).toBe(false);
    expect(rendered.preview_urls).toBe(false);
    expect(rendered.routes).toEqual([{ pattern: "www.example.co.jp", custom_domain: true }]);
    expect(rendered.vars).toEqual({ CMS_MODE: "live", CMS_BASE_URL: "https://cms.example.co.jp", CMS_SITE_KEY: "ami" });
    // 開発用の設定（互換日付・静的ファイル）は引き継ぐ
    expect(rendered.compatibility_date).toBe(base.compatibility_date);
    expect(rendered.assets).toEqual(base.assets);
    expect(rendered.$schema).toBeUndefined();
  });

  it("公開キーなどの Secret を設定ファイルに書かない", () => {
    expect(JSON.stringify(renderWranglerConfig(base, valid))).not.toMatch(/ssdk_|DELIVERY_KEY/);
  });
});

describe("stripJsonc", () => {
  it("コメントと末尾カンマを取り除き、文字列の中の // は残す", () => {
    const text = '{\n  // コメント\n  "url": "https://example.com", /* 範囲 */\n  "list": [1, 2,],\n}';
    expect(JSON.parse(stripJsonc(text))).toEqual({ url: "https://example.com", list: [1, 2] });
  });
});
