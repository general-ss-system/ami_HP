import { describe, expect, it, vi } from "vitest";
import type { CmsClient } from "./client";
import { createFixtureClient } from "./fixture-client";
import { fixtureHome, fixtureMembers, fixtureSiteInfo } from "./fixtures";
import { mapMember, mapSiteInfo, toStatementLines } from "./mapper";
import type { SiteInfo } from "./types";
import {
  getAboutPageData,
  getAllTopics,
  getContactPageData,
  getMemberPageData,
  getPrivacyPageData,
  getFaqPageData,
  getRecruitPageData,
  getServicePageData,
  getTopicDetail,
  getTopicsArchive,
  getTopPageData,
  getAllWorks,
  getWorkDetail,
  getWorksArchive,
} from "./queries";
import { pageOgImage, pageTitle } from "../seo";

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

  it("MEMBER: 紹介文とプロフィール（生年月日・SNS・写真）を持つ", async () => {
    const { members } = await getMemberPageData(createFixtureClient());
    expect(members).toHaveLength(9);
    expect(members[0]?.profile).toBeTruthy();
    expect(members[0]?.birthday).toBe("1998-06-12");
    expect(members[0]?.sns.map((s) => s.service)).toEqual(["Instagram", "X", "TikTok"]);
    expect(members[0]?.photos).toHaveLength(4);
  });

  it("MEMBER: SNS は http(s) の URL とアカウント名があるものだけを出す", () => {
    const base = fixtureMembers[0]!;
    const r = mapMember({
      ...base,
      content: {
        ...base.content,
        instagram: { label: "@a", href: "javascript:alert(1)", target: "_blank" },
        x: { label: "  ", href: "https://x.com/a", target: "_blank" },
      },
    });
    expect(r.ok && r.value.sns.map((s) => s.service)).toEqual(["TikTok"]);
  });

  it("TOPICS 一覧: 分類で絞り込み、範囲外のページは null", async () => {
    const client = createFixtureClient();
    const all = await getTopicsArchive(client, { category: null, page: 1 });
    expect(all?.topics.length).toBe(8);
    // Pick UP! は 1 ページ目（分類なし）だけ。pickup を付けた記事を新しい順に
    expect(all?.pickups.map((t) => t.slug)).toEqual(["brand-movie", "sample-sns", "sample-column"]);
    const news = await getTopicsArchive(client, { category: "news", page: 1 });
    expect(news?.topics.every((t) => t.category === "news")).toBe(true);
    expect(news?.pickups).toEqual([]);
    expect(await getTopicsArchive(client, { category: null, page: 2 })).toBeNull();
    expect((await getAllTopics(client)).length).toBe(8);
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

  it("RECRUIT: メッセージ・職場写真と、募集中の職種だけを新しい順に返す", async () => {
    const report = vi.fn();
    const data = await getRecruitPageData(createFixtureClient(), report);
    expect(report).not.toHaveBeenCalled();
    expect(data.recruit?.messageTitle).toBeTruthy();
    expect(data.recruit?.gallery.length).toBeGreaterThan(0);
    expect(data.positions.map((p) => p.slug)).toEqual(["sns-planner", "creator-intern"]);
    expect(data.positions[0]?.description.length).toBeGreaterThan(0);
  });

  it("RECRUIT: recruit を取れなくても職種は出す", async () => {
    const report = vi.fn();
    const client: CmsClient = { ...createFixtureClient(), getSingleton: async (key) => {
      if (key === "recruit") throw new Error("model not enabled");
      return createFixtureClient().getSingleton(key);
    } };
    const data = await getRecruitPageData(client, report);
    expect(data.recruit).toBeNull();
    expect(data.positions).toHaveLength(2);
    expect(report).toHaveBeenCalled();
  });

  it("FAQ: 表示順に並べ、回答を持つ", async () => {
    const report = vi.fn();
    const data = await getFaqPageData(createFixtureClient(), report);
    expect(report).not.toHaveBeenCalled();
    expect(data.faqs.length).toBeGreaterThan(0);
    expect(data.faqs[0]?.question).toContain("相談");
    expect(data.faqs.every((f) => f.answer.length > 0)).toBe(true);
  });

  it("PRIVACY POLICY: contact_page の個人情報の取り扱いを本文にする", async () => {
    const data = await getPrivacyPageData(createFixtureClient());
    expect(data.privacyNote.length).toBeGreaterThan(0);
  });

  it("PRIVACY POLICY: contact_page を取れなければ本文は空にして報告する", async () => {
    const report = vi.fn();
    const client: CmsClient = { ...createFixtureClient(), getSingleton: () => Promise.reject(new Error("down")) };
    const data = await getPrivacyPageData(client, report);
    expect(data.privacyNote).toEqual([]);
    expect(report).toHaveBeenCalled();
  });
});

describe("site_info", () => {
  it("トップページでも取得し、連絡先と SNS の URL を持つ", async () => {
    const { siteInfo } = await getTopPageData(createFixtureClient());
    expect(siteInfo?.defaultTitle).toBeTruthy();
    expect(siteInfo?.phone).toBeTruthy();
    expect(siteInfo?.instagramUrl).toMatch(/^https:\/\//);
  });

  it("SNS の URL は http(s) だけを通す", () => {
    const r = mapSiteInfo({
      ...fixtureSiteInfo,
      content: {
        ...fixtureSiteInfo.content,
        instagram_url: { label: "Instagram", href: "javascript:alert(1)", target: "_blank" },
        x_url: { label: "X", href: "/about", target: "_self" },
      },
    });
    expect(r.ok && r.value.instagramUrl).toBeNull();
    expect(r.ok && r.value.xUrl).toBeNull();
  });

  it("OGP 画像はページの画像 → site_info の既定の画像の順に使う", () => {
    const site = new URL("https://example.com");
    const info = { defaultOgImage: { url: "/og.png", alt: null, width: 1200, height: 630 } } as SiteInfo;
    expect(pageOgImage(site, info)).toBe("https://example.com/og.png");
    expect(pageOgImage(site, info, { url: "https://cdn.example.com/a.jpg", alt: null, width: 1, height: 1 })).toBe("https://cdn.example.com/a.jpg");
    expect(pageOgImage(site, null)).toBeUndefined();
  });
});

describe("pageTitle", () => {
  it("site_info のテンプレートにページ名を差し込む", async () => {
    const { siteInfo } = await getAboutPageData(createFixtureClient());
    expect(pageTitle(siteInfo, "About")).toBe("About | 合同会社ami");
    expect(pageTitle(null, "About")).toBe("About");
  });
});

describe("WORKS", () => {
  it("一覧: 公開日の新しい順、タグ（いずれかに一致）で絞り込む", async () => {
    const client = createFixtureClient();
    const all = await getWorksArchive(client, { tag: null, page: 1 });
    expect(all?.works.map((w) => w.publishedDate)).toEqual(["2026-09-10", "2026-08-28", "2026-08-05", "2026-07-20", "2026-06-30"]);
    const branding = await getWorksArchive(client, { tag: "branding", page: 1 });
    expect(branding?.works.map((w) => w.slug)).toEqual(["sample-work-1", "sample-work-2"]);
    expect(await getWorksArchive(client, { tag: null, page: 2 })).toBeNull();
    expect(await getAllWorks(client)).toHaveLength(5);
  });

  it("詳細: ギャラリー・本文・外部リンクと、ほかの実績 3 件", async () => {
    const data = await getWorkDetail(createFixtureClient(), "sample-work-1");
    expect(data?.work.gallery).toHaveLength(3);
    expect(data?.work.body.length).toBeGreaterThan(0);
    expect(data?.work.externalLink?.external).toBe(true);
    expect(data?.others.map((w) => w.slug)).toEqual(["sample-work-2", "sample-work-3", "sample-work-4"]);
    expect(await getWorkDetail(createFixtureClient(), "nope")).toBeNull();
  });

  it("選択肢に無いタグは読み飛ばす", async () => {
    const base = createFixtureClient();
    const client: CmsClient = {
      ...base,
      async getEntry(model, slug) {
        const e = await base.getEntry(model, slug);
        return e && { ...e, content: { ...e.content, tags: ["web", "unknown"] } };
      },
    };
    expect((await getWorkDetail(client, "sample-work-1"))?.work.tags).toEqual(["web"]);
  });
});
