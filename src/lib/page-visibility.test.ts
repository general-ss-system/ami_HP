import { describe, expect, it, vi } from "vitest";
import { CmsError, type CmsClient } from "./cms/client";
import { createFixtureClient } from "./cms/fixture-client";
import { getPageVisibility, getSiteInfo, isPageVisible } from "./cms/queries";
import { footerItems } from "../config/site";
import { hiddenPageHtml, isHiddenPageHtml } from "./deploy/hidden-pages";

const entry = (content: Record<string, unknown>) => ({ id: "e", slug: null, content, publishedAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z" });

describe("ページの表示設定（CMS: ami_page_visibility）", () => {
  it("true のページだけ表示にする（未入力は非表示）", async () => {
    const client: CmsClient = { ...createFixtureClient(), getSingleton: async () => entry({ show_works: true, show_recruit: null }) };
    expect(await getPageVisibility(client)).toEqual({ works: true, recruit: false, faq: false });
  });

  it("まだ作られていない（404）ときは、報告せずにすべて非表示にする", async () => {
    const report = vi.fn();
    const client: CmsClient = { ...createFixtureClient(), getSingleton: () => Promise.reject(new CmsError("not found", 404, "NOT_FOUND")) };
    expect(await getPageVisibility(client, report)).toEqual({ works: false, recruit: false, faq: false });
    expect(report).not.toHaveBeenCalled();
  });

  it("読めないとき（CMS の障害）は報告して、すべて非表示にする", async () => {
    const report = vi.fn();
    const client: CmsClient = { ...createFixtureClient(), getSingleton: () => Promise.reject(new CmsError("down", 500, "INTERNAL")) };
    expect(await getPageVisibility(client, report)).toEqual({ works: false, recruit: false, faq: false });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("getSiteInfo がサイト基本情報に表示設定を足す。site_info が無ければ非表示として扱う", async () => {
    const info = await getSiteInfo(createFixtureClient());
    expect(info?.pageVisibility).toEqual({ works: false, recruit: false, faq: false });
    expect(isPageVisible(null, "works")).toBe(false);
    expect(isPageVisible({ pageVisibility: { works: true, recruit: false, faq: false } }, "works")).toBe(true);
  });

  it("フッターは表示中のページだけを載せ、ヘッダーのページ・CONTACT・PRIVACY POLICY は常に載せる", () => {
    expect(footerItems({ works: false, recruit: false, faq: false }).map((i) => i.label)).toEqual([
      "ABOUT",
      "SERVICE",
      "MEMBER",
      "TOPICS",
      "CONTACT",
      "PRIVACY POLICY",
    ]);
    expect(footerItems({ works: true, recruit: false, faq: true }).map((i) => i.label)).toEqual([
      "ABOUT",
      "SERVICE",
      "MEMBER",
      "TOPICS",
      "WORKS",
      "FAQ",
      "CONTACT",
      "PRIVACY POLICY",
    ]);
  });

  it("非表示のページの静的書き出しには目印を入れ、それを見分けられる", () => {
    expect(isHiddenPageHtml(hiddenPageHtml())).toBe(true);
    expect(isHiddenPageHtml("<html><head><title>FAQ</title></head></html>")).toBe(false);
  });
});
