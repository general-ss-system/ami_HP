import { describe, expect, it, vi } from "vitest";
import type { CmsClient } from "./client";
import { createFixtureClient } from "./fixture-client";
import { fixtureHome } from "./fixtures";
import { toStatementLines } from "./mapper";
import { getTopPageData } from "./queries";

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
