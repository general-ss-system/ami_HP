import { describe, expect, it, vi } from "vitest";
import { entryPath, isEmptyRichText, sanitizeHref, toRichText } from "./richtext";

const root = (...children: unknown[]) => ({ root: { type: "root", children } });
const text = (t: string, format = 0) => ({ type: "text", text: t, format });

describe("sanitizeHref", () => {
  it("http(s)・mailto・tel・サイト内パスだけを通す", () => {
    expect(sanitizeHref("https://example.com/a")).toEqual({ href: "https://example.com/a", external: true });
    expect(sanitizeHref("mailto:a@example.com")).toEqual({ href: "mailto:a@example.com", external: false });
    expect(sanitizeHref("/service")).toEqual({ href: "/service", external: false });
    expect(sanitizeHref("#top")).toEqual({ href: "#top", external: false });
  });

  it("javascript: やプロトコル相対 URL は通さない", () => {
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeHref(" JavaScript:alert(1)")).toBeNull();
    expect(sanitizeHref("//evil.example.com")).toBeNull();
    expect(sanitizeHref("data:text/html,x")).toBeNull();
    expect(sanitizeHref(42)).toBeNull();
  });
});

describe("entryPath", () => {
  it("モデルごとのページへのパスにする", () => {
    expect(entryPath({ id: "1", model: "ami_topics", slug: "hello" })).toBe("/topics/hello");
    expect(entryPath({ id: "2", model: "ami_services", slug: "sns" })).toBe("/service#sns");
    expect(entryPath({ id: "3", model: "ami_topics", slug: null })).toBeNull();
    expect(entryPath({ id: "4", model: "unknown", slug: "x" })).toBeNull();
  });
});

describe("toRichText", () => {
  it("段落・見出し・書式・改行を変換する", () => {
    const blocks = toRichText(
      root(
        { type: "heading", tag: "h1", children: [text("大見出し")] },
        { type: "heading", tag: "h3", children: [text("小見出し")] },
        { type: "paragraph", children: [text("太字", 1), { type: "linebreak" }, text("斜体", 2)] },
      ),
    );
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 2 });
    expect(blocks[1]).toMatchObject({ kind: "heading", level: 3 });
    expect(blocks[2]).toMatchObject({
      kind: "paragraph",
      children: [{ kind: "text", text: "太字", bold: true }, { kind: "break" }, { kind: "text", text: "斜体", italic: true }],
    });
  });

  it("危険なリンクは外して文字だけ残す", () => {
    const [p] = toRichText(root({ type: "paragraph", children: [{ type: "link", url: "javascript:x", children: [text("押す")] }] }));
    expect(p).toEqual({ kind: "paragraph", children: [expect.objectContaining({ kind: "text", text: "押す" })] });
  });

  it("未公開の記事への内部リンクは文字だけにする", () => {
    const [p] = toRichText(root({ type: "paragraph", children: [{ type: "link", entry: null, children: [text("記事")] }] }));
    expect(p).toEqual({ kind: "paragraph", children: [expect.objectContaining({ kind: "text", text: "記事" })] });
  });

  it("入れ子のリストを直前の項目の子にする", () => {
    const [list] = toRichText(
      root({
        type: "list",
        listType: "bullet",
        children: [
          { type: "listitem", children: [text("親")] },
          { type: "listitem", children: [{ type: "list", listType: "number", children: [{ type: "listitem", children: [text("子")] }] }] },
        ],
      }),
    );
    expect(list).toMatchObject({
      kind: "list",
      ordered: false,
      items: [{ children: [{ text: "親" }], lists: [{ ordered: true, items: [{ children: [{ text: "子" }] }] }] }],
    });
  });

  it("未知のノードと、画像の解決できない画像ノードは飛ばして報告する", () => {
    const report = vi.fn();
    const blocks = toRichText(
      root({ type: "table", children: [] }, { type: "image", media: null }, { type: "paragraph", children: [text("残る")] }),
      report,
    );
    expect(blocks).toHaveLength(1);
    expect(report).toHaveBeenCalledTimes(2);
  });

  it("形が違う値は空にする", () => {
    expect(toRichText(null)).toEqual([]);
    expect(toRichText({ root: "x" })).toEqual([]);
    expect(isEmptyRichText(toRichText(root({ type: "paragraph", children: [] })))).toBe(true);
  });
});
