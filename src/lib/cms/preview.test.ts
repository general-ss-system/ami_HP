import { describe, expect, it, vi } from "vitest";
import { PreviewTokenError, createPreviewClient, previewToDeliveryEntry } from "./client";
import { resolvePreviewPath, safeReturnPath } from "./preview";

const draft = {
  id: "e1",
  slug: "draft-post",
  status: "draft" as const,
  content: { title: "下書き" },
  publishedAt: null,
  scheduledAt: null,
  updatedAt: "2026-09-26T00:00:00.000Z",
};

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function client(f: ReturnType<typeof mockFetch>) {
  return createPreviewClient(
    { baseUrl: "https://cms.example.com", siteKey: "ami", deliveryKey: "ssdk_test", fetch: f as unknown as typeof fetch },
    "tok_1",
  );
}

describe("createPreviewClient", () => {
  it("公開キーとトークンの両方を送り、下書きを Delivery の形に寄せる", async () => {
    const f = mockFetch(200, { preview: true, data: draft });
    const entry = await client(f).getEntry("ami_topics", "draft-post");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://cms.example.com/api/v1/preview/ami/content/ami_topics/draft-post");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer ssdk_test");
    expect(headers.get("X-Preview-Token")).toBe("tok_1");
    // 未公開なので publishedAt は下書きの保存日時で代える
    expect(entry).toEqual({ id: "e1", slug: "draft-post", content: { title: "下書き" }, publishedAt: draft.updatedAt, updatedAt: draft.updatedAt });
  });

  it("ID で 1 件取得できる（slug が変わった下書きでも開ける）", async () => {
    const f = mockFetch(200, { preview: true, data: draft });
    await client(f).getEntryById("ami_topics", "e1");
    expect(f.mock.calls[0]![0]).toBe("https://cms.example.com/api/v1/preview/ami/entries/ami_topics/e1");
  });

  it("Delivery の応答（preview: true が無い）は受け付けない", async () => {
    const f = mockFetch(200, { data: { ...draft, status: undefined } });
    await expect(client(f).getSingleton("about")).rejects.toMatchObject({ code: "CONTRACT_MISMATCH" });
  });

  it("401 は PreviewTokenError、404 は null", async () => {
    const unauthorized = mockFetch(401, { error: { code: "UNAUTHORIZED", message: "x", requestId: "r1" } });
    await expect(client(unauthorized).getSingleton("about")).rejects.toBeInstanceOf(PreviewTokenError);
    const notFound = mockFetch(404, { error: { code: "NOT_FOUND", message: "x", requestId: "r2" } });
    expect(await client(notFound).getEntry("works", "nope")).toBeNull();
  });

  it("一覧も下書きを含めて返す", async () => {
    const f = mockFetch(200, { preview: true, data: [draft], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } });
    const res = await client(f).getCollection("works", { filter: { tags: "web" }, limit: 12 });
    expect(res.data[0]?.id).toBe("e1");
    expect(String(f.mock.calls[0]![0])).toContain("filter%5Btags%5D=web");
  });

  it("previewToDeliveryEntry は公開済みなら公開日時を保つ", () => {
    expect(previewToDeliveryEntry({ ...draft, status: "published", publishedAt: "2026-09-01T00:00:00.000Z" }).publishedAt).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });
});

describe("resolvePreviewPath", () => {
  it("モデルごとのページへ送る", () => {
    expect(resolvePreviewPath("ami_home", null)).toBe("/");
    expect(resolvePreviewPath("about", null)).toBe("/about");
    expect(resolvePreviewPath("contact_page", null)).toBe("/contact");
    expect(resolvePreviewPath("ami_topics", "hello")).toBe("/topics/hello");
    expect(resolvePreviewPath("works", "w1")).toBe("/works/w1");
    expect(resolvePreviewPath("ami_services", "sns")).toBe("/service#sns");
    expect(resolvePreviewPath("members", "m1")).toBe("/member#m1");
  });

  it("slug が無ければ一覧、ページの無いモデルは null", () => {
    expect(resolvePreviewPath("ami_topics", null)).toBe("/topics");
    expect(resolvePreviewPath("faq", "x")).toBeNull();
  });
});

describe("safeReturnPath", () => {
  it("サイト内のパスだけを受け付ける", () => {
    expect(safeReturnPath("/topics/a?x=1")).toBe("/topics/a?x=1");
    expect(safeReturnPath("//evil.example.com")).toBe("/");
    // ブラウザは "/\" を "//" と同じに扱う
    expect(safeReturnPath("/\\evil.example.com")).toBe("/");
    expect(safeReturnPath("https://evil.example.com")).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
  });
});
