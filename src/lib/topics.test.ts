import { describe, expect, it } from "vitest";
import type { Topic } from "./cms/types";
import { formatTopicDate, laterPages, parsePageParam, topicHref, topicsListHref } from "./topics";

const topic: Topic = {
  id: "1",
  slug: "hello",
  title: "t",
  category: "news",
  thumbnail: null,
  excerpt: null,
  publishedDate: "2026-09-20",
  externalLink: null,
};

describe("topics の URL", () => {
  it("一覧・分類・ページ送りの URL", () => {
    expect(topicsListHref(null)).toBe("/topics");
    expect(topicsListHref(null, 2)).toBe("/topics/page/2");
    expect(topicsListHref("sns")).toBe("/topics/category/sns");
    expect(topicsListHref("sns", 3)).toBe("/topics/category/sns/page/3");
  });

  it("カードのリンク先: 外部リンクがあればそれを優先する", () => {
    expect(topicHref(topic)).toEqual({ href: "/topics/hello", external: false });
    expect(topicHref({ ...topic, externalLink: { label: "x", href: "https://example.com/", external: true } })).toEqual({
      href: "https://example.com/",
      external: true,
    });
    expect(topicHref({ ...topic, slug: null })).toEqual({ href: "/topics", external: false });
  });

  it("ページ番号は 2 以上の数字だけ受け付ける", () => {
    expect(parsePageParam("2")).toBe(2);
    expect(parsePageParam("1")).toBeNull();
    expect(parsePageParam("02x")).toBeNull();
    expect(parsePageParam(undefined)).toBeNull();
    expect(laterPages(3)).toEqual([2, 3]);
    expect(laterPages(1)).toEqual([]);
  });

  it("日付の表示", () => {
    expect(formatTopicDate("2026-09-20")).toBe("2026.09.20");
    expect(formatTopicDate("不明")).toBe("不明");
  });
});
