import { describe, expect, it, vi } from "vitest";
import type { CmsClient } from "./cms/client";
import { createFixtureClient } from "./cms/fixture-client";
import { getSitemapEntries, renderSitemap, staticPaths } from "./sitemap";

const ALL = { works: true, recruit: true, faq: true };
const NONE = { works: false, recruit: false, faq: false };

describe("sitemap", () => {
  it("固定のページと、記事・実績の詳細ページを載せる（外部リンクの記事は除く）", async () => {
    const entries = await getSitemapEntries(createFixtureClient(), ALL);
    const paths = entries.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(["/", "/about", "/privacy", "/faq", "/recruit", "/topics/sample-news", "/works/sample-work-1"]));
    expect(paths).not.toContain("/topics/sample-sns-3");
    expect(entries.find((e) => e.path === "/works/sample-work-1")?.lastmod).toBe("2026-09-10");
  });

  it("ページの表示設定で非表示のページ（と実績の詳細）は載せない。ヘッダーのページ・CONTACT・PRIVACY は常に載せる", async () => {
    const paths = (await getSitemapEntries(createFixtureClient(), { ...NONE, faq: true })).map((e) => e.path);
    expect(paths.some((p) => p.startsWith("/works") || p === "/recruit")).toBe(false);
    expect(paths).toContain("/faq");
    expect(staticPaths(NONE)).toEqual(["/", "/about", "/service", "/member", "/topics", "/contact", "/privacy"]);
  });

  it("記事・実績を取得できなければ固定のページだけにして報告する", async () => {
    const report = vi.fn();
    const client: CmsClient = { ...createFixtureClient(), getCollection: () => Promise.reject(new Error("down")) };
    const entries = await getSitemapEntries(client, ALL, report);
    expect(entries.map((e) => e.path)).toEqual(staticPaths(ALL));
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("絶対 URL の XML にし、特殊文字をエスケープする", () => {
    const xml = renderSitemap([{ path: "/topics/a&b", lastmod: "2026-09-01" }], new URL("https://example.com"));
    expect(xml).toContain("<loc>https://example.com/topics/a&amp;b</loc><lastmod>2026-09-01</lastmod>");
  });

  it("静的に書き出すときは末尾スラッシュ付きの URL にする（canonical と揃える）", () => {
    const xml = renderSitemap([{ path: "/" }, { path: "/about" }], new URL("https://example.com"), { trailingSlash: true });
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<loc>https://example.com/about/</loc>");
  });
});
