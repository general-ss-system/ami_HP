import { describe, expect, it, vi } from "vitest";
import { CmsError, createCmsClient } from "./client";

const entry = {
  id: "e1",
  slug: "hello",
  content: { title: "Hello" },
  publishedAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function client(fetchImpl: ReturnType<typeof mockFetch>) {
  return createCmsClient({
    baseUrl: "https://cms.example.com/",
    siteKey: "ami",
    deliveryKey: "ssdk_test",
    fetch: fetchImpl as unknown as typeof fetch,
  });
}

describe("createCmsClient", () => {
  it("公開キーを Authorization に載せて singleton を取得する", async () => {
    const f = mockFetch(200, { data: entry });
    const result = await client(f).getSingleton("ami_home");

    expect(result).toEqual(entry);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://cms.example.com/api/v1/delivery/ami/singletons/ami_home");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer ssdk_test");
  });

  it("一覧のクエリを組み立てる", async () => {
    const f = mockFetch(200, { data: [entry], meta: { page: 1, limit: 3, total: 1, totalPages: 1 } });
    await client(f).getCollection("ami_topics", { limit: 3, sort: "-publishedAt", filter: { category: "news" } });

    const url = new URL(String(f.mock.calls[0]![0]));
    expect(url.pathname).toBe("/api/v1/delivery/ami/content/ami_topics");
    expect(url.searchParams.get("limit")).toBe("3");
    expect(url.searchParams.get("sort")).toBe("-publishedAt");
    expect(url.searchParams.get("filter[category]")).toBe("news");
  });

  it("詳細が 404 なら null を返す", async () => {
    const f = mockFetch(404, { error: { code: "NOT_FOUND", message: "not found", requestId: "r1" } });
    await expect(client(f).getEntry("ami_topics", "nope")).resolves.toBeNull();
  });

  it("エラー応答を CmsError にする", async () => {
    const f = mockFetch(401, { error: { code: "UNAUTHORIZED", message: "bad key", requestId: "r2" } });
    const err = await client(f).getSingleton("ami_home").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CmsError);
    expect(err).toMatchObject({ status: 401, code: "UNAUTHORIZED", requestId: "r2" });
  });

  it("契約に無いフィールドが混ざった応答を拒否する", async () => {
    const f = mockFetch(200, { data: { ...entry, draft_data: {} } });
    await expect(client(f).getSingleton("ami_home")).rejects.toMatchObject({ code: "CONTRACT_MISMATCH" });
  });
});
