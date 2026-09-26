import { describe, expect, it, vi } from "vitest";
import type { CmsClient } from "./client";
import { createFixtureClient } from "./fixture-client";
import { fixtureHome } from "./fixtures";
import { toStatementLines } from "./mapper";
import {
  getAboutPageData,
  getAllTopics,
  getContactPageData,
  getMemberPageData,
  getServicePageData,
  getTopicDetail,
  getTopicsArchive,
  getTopPageData,
} from "./queries";
import { pageTitle } from "../seo";

describe("toStatementLines", () => {
  it("強調語句を含む行を分割する", () => {
    const lines = toStatementLines("合同会社amiは、\nそんな「トキメキの発生点」を生み出す", "「トキメキの発生点」");
    expect(lines).toEqual([
      { before: "合同会社amiは、", highlight: null, after: "" },
      { before: "そんな", highlight: "「トキメキの発生点」", after: "を生み出す" },
    ]);
  });

  it("強調語句が本文に無ければ強調しない", () => {
    expect(toStatementLines("あいう", "えお")).toEqual([{ before: "あいう", highlight: null, after: "" }]);
  });
});

describe("getTopPageData", () => {
  it("仮データでトップページのデータ一式が揃う", async () => {
    const report = vi.fn();
    const data = await getTopPageData(createFixtureClient(), report);

    expect(report).not.toHaveBeenCalled();
    expect(data.home?.heroImages).toHaveLength(3);
    expect(data.services.map((s) => s.title)).toEqual(["SNSマーケティング事業", "商品開発事業"]);
    expect(data.topics).toHaveLength(4);
    expect(data.topics[0]?.category).toBe("news");
    expect(data.members).toHaveLength(6);
  });

  it("不正なエントリは除外して報告し、他のセクションは表示できる", async () => {
    const base = createFixtureClient();
    const client: CmsClient = {
      ...base,
      async getSingleton() {
        return { ...fixtureHome, content: { ...fixtureHome.content, hero_images: [] } };
      },
    };
    const report = vi.fn();
    const data = await getTopPageData(client, report);

    expect(data.home).toBeNull();
    expect(report).toHaveBeenCalledWith(
      "entry failed validation",
      expect.objectContaining({ model: "ami_home", fields: ["hero_images"] }),
    );
    expect(data.members).toHaveLength(6);
  });

  it("取得に失敗したセクションは空になり、ページは壊れない", async () => {
    const base = createFixtureClient();
    const client: CmsClient = {
      ...base,
      async getCollection(modelKey, query) {
        if (modelKey === "members") throw new Error("network");
        return base.getCollection(modelKey, query);
      },
    };
    const report = vi.fn();
    const data = await getTopPageData(client, report);

    expect(data.members).toEqual([]);
    expect(data.services).toHaveLength(2);
    expect(report).toHaveBeenCalledWith("failed to load members", expect.any(Error));
  });
});

describe("下層ページ", () => {
  it("ABOUT: ステートメント・メッセージ・会社概要が揃う", async () => {
    const report = vi.fn();
    const data = await getAboutPageData(createFixtureClient(), report);
    expect(report).not.toHaveBeenCalled();
    expect(data.siteInfo?.companyName).toBe("合同会社ami");
    expect(data.home?.statement.lines.length).toBeGreaterThan(0);
    expect(data.about?.body.length).toBeGreaterThan(0);
  });

  it("SERVICE: 本文とアンカー用の slug を持つ", async () => {
    const { services } = await getServicePageData(createFixtureClient());
    expect(services.map((s) => s.slug)).toEqual(["sns-marketing", "product-development"]);
    expect(services[0]?.body.some((b) => b.kind === "list")).toBe(true);
  });

  it("MEMBER: 紹介文を持つ", async () => {
    const { members } = await getMemberPageData(createFixtureClient());
    expect(members).toHaveLength(6);
    expect(members[0]?.profile).toContain("紹介文");
  });

  it("TOPICS 一覧: 分類で絞り込み、範囲外のページは null", async () => {
    const client = createFixtureClient();
    const all = await getTopicsArchive(client, { category: null, page: 1 });
    expect(all?.topics.length).toBe(7);
    const news = await getTopicsArchive(client, { category: "news", page: 1 });
    expect(news?.topics.every((t) => t.category === "news")).toBe(true);
    expect(await getTopicsArchive(client, { category: null, page: 2 })).toBeNull();
    expect((await getAllTopics(client)).length).toBe(7);
  });

  it("TOPICS 詳細: 本文と新着を返し、無い記事・外部リンクの記事は null", async () => {
    const client = createFixtureClient();
    const data = await getTopicDetail(client, "sample-news");
    expect(data?.topic.body.length).toBeGreaterThan(0);
    expect(data?.recent.map((t) => t.slug)).not.toContain("sample-news");
    expect(await getTopicDetail(client, "missing")).toBeNull();
    expect(await getTopicDetail(client, "sample-sns-3")).toBeNull();
  });

  it("CONTACT: 同意文とフォーム定義が揃う", async () => {
    const data = await getContactPageData(createFixtureClient());
    expect(data.contactPage?.consentLabel).toBeTruthy();
    expect(data.form?.fields.map((f) => f.key)).toEqual(["name", "company", "email", "message"]);
  });

  it("CONTACT: フォーム定義を取れなければ null にして報告する", async () => {
    const report = vi.fn();
    const client: CmsClient = { ...createFixtureClient(), getForm: () => Promise.reject(new Error("down")) };
    const data = await getContactPageData(client, report);
    expect(data.form).toBeNull();
    expect(report).toHaveBeenCalled();
  });
});

describe("pageTitle", () => {
  it("site_info のテンプレートにページ名を差し込む", async () => {
    const { siteInfo } = await getAboutPageData(createFixtureClient());
    expect(pageTitle(siteInfo, "About")).toBe("About | 合同会社ami");
    expect(pageTitle(null, "About")).toBe("About");
  });
});
