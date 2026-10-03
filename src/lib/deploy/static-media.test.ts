import { describe, expect, it } from "vitest";
import { apacheConfig, collectMediaKeys, rewriteMediaUrls } from "./static-media";

const base = "https://ami-cms.example.workers.dev/media";
const site = "https://www.example.co.jp";

describe("collectMediaKeys", () => {
  it("HTML・CSS・JSON の中の CMS の画像の保存キーを重複なく拾う", () => {
    const html = [
      `<img src="${base}/sites/s1/a.webp" alt="">`,
      `<div style="background:url(${base}/sites/s1/b.png)"></div>`,
      `{"url":"${base}/sites/s1/a.webp"}`,
      `<img src='${base}/sites/s1/c.jpg?v=1'>`,
    ].join("\n");
    expect(collectMediaKeys(html, base)).toEqual(["sites/s1/a.webp", "sites/s1/b.png", "sites/s1/c.jpg"]);
  });

  it("サイトの外へ出るキーや、別のホストの URL は拾わない", () => {
    const html = `<img src="${base}/../secret"><img src="https://evil.example/media/x.png"><img src="${base}/.hidden">`;
    expect(collectMediaKeys(html, base)).toEqual([]);
  });

  it("CMS の URL の末尾のスラッシュの有無を問わない", () => {
    expect(collectMediaKeys(`<img src="${base}/a.png">`, `${base}/`)).toEqual(["a.png"]);
  });
});

describe("rewriteMediaUrls", () => {
  it("本文中の画像はサイト内のパス、OGP の画像はサイトの絶対URLにする", () => {
    const html = `<meta property="og:image" content="${base}/sites/s1/og.png"><img src="${base}/sites/s1/a.webp">`;
    expect(rewriteMediaUrls(html, base, site)).toBe(
      `<meta property="og:image" content="${site}/media/sites/s1/og.png"><img src="/media/sites/s1/a.webp">`,
    );
  });

  it("形の不正なキーは書き換えない（取り込んでいないファイルを指さない）", () => {
    const html = `<img src="${base}/../x.png">`;
    expect(rewriteMediaUrls(html, base, site)).toBe(html);
  });

  it("CMS の画像が無ければ何も変えない", () => {
    const html = `<img src="/_astro/logo.webp">`;
    expect(rewriteMediaUrls(html, base, site)).toBe(html);
  });
});

describe("apacheConfig", () => {
  it("404 ページを指定し、取り込んだ画像とハッシュ付きのファイルを長く持たせる", () => {
    const conf = apacheConfig();
    expect(conf).toContain("ErrorDocument 404 /404.html");
    expect(conf).toMatch(/\(media\|_astro\)/);
  });
});
