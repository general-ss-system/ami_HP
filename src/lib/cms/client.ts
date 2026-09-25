/**
 * Delivery API の HTTP クライアント（CMS docs/04 §12 の `client`）。
 *
 * 認証・ベースURL・応答の検証・エラーの形をここに閉じ込める。
 * 画面部品からは呼ばず、`queries.ts` を経由して使う。
 */

import type { z } from "zod";
import {
  DELIVERY_AUTH_SCHEME,
  DeliveryDetailResponseSchema,
  DeliveryListResponseSchema,
  ErrorResponseSchema,
  type DeliveryEntry,
  type DeliveryListResponse,
} from "./contracts";

export interface CmsClientConfig {
  /** 例: https://cms.example.co.jp （末尾スラッシュは無視する） */
  baseUrl: string;
  siteKey: string;
  deliveryKey: string;
  /** テストで差し替えるため。 */
  fetch?: typeof fetch;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  /** `publishedAt` / `updatedAt` / indexed なフィールド。先頭 `-` で降順。 */
  sort?: string;
  /** indexed なフィールドの等価一致のみ。 */
  filter?: Record<string, string>;
}

/** CMS から失敗が返った、または応答が契約に合わなかった。 */
export class CmsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "CmsError";
  }
}

export interface CmsClient {
  getSingleton(modelKey: string): Promise<DeliveryEntry>;
  /** 未公開・存在しない slug は null（404 をページ側で扱えるように）。 */
  getEntry(modelKey: string, slug: string): Promise<DeliveryEntry | null>;
  getCollection(modelKey: string, query?: ListQuery): Promise<DeliveryListResponse>;
}

export function createCmsClient(config: CmsClientConfig): CmsClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const doFetch = config.fetch ?? fetch;
  const root = `${baseUrl}/api/v1/delivery/${encodeURIComponent(config.siteKey)}`;

  async function request<T extends z.ZodType>(url: string, schema: T): Promise<z.infer<T>> {
    const res = await doFetch(url, {
      headers: {
        Authorization: `${DELIVERY_AUTH_SCHEME} ${config.deliveryKey}`,
        Accept: "application/json",
      },
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const parsed = ErrorResponseSchema.safeParse(body);
      if (parsed.success) {
        const { code, message, requestId } = parsed.data.error;
        throw new CmsError(message, res.status, code, requestId);
      }
      throw new CmsError(`CMS returned HTTP ${res.status}`, res.status, "UNKNOWN");
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // 契約違反（未知のフィールドの混入など）。黙って描画せずに失敗させる。
      throw new CmsError(`Unexpected response shape: ${parsed.error.message}`, res.status, "CONTRACT_MISMATCH");
    }
    return parsed.data;
  }

  return {
    async getSingleton(modelKey) {
      const res = await request(`${root}/singletons/${encodeURIComponent(modelKey)}`, DeliveryDetailResponseSchema);
      return res.data;
    },

    async getEntry(modelKey, slug) {
      try {
        const res = await request(
          `${root}/content/${encodeURIComponent(modelKey)}/${encodeURIComponent(slug)}`,
          DeliveryDetailResponseSchema,
        );
        return res.data;
      } catch (err) {
        if (err instanceof CmsError && err.status === 404) return null;
        throw err;
      }
    },

    async getCollection(modelKey, query = {}) {
      const params = new URLSearchParams();
      if (query.page !== undefined) params.set("page", String(query.page));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      if (query.sort !== undefined) params.set("sort", query.sort);
      for (const [key, value] of Object.entries(query.filter ?? {})) {
        params.set(`filter[${key}]`, value);
      }
      const qs = params.size > 0 ? `?${params.toString()}` : "";
      return request(`${root}/content/${encodeURIComponent(modelKey)}${qs}`, DeliveryListResponseSchema);
    },
  };
}
