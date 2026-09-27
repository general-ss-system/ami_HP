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
  PREVIEW_TOKEN_HEADER,
  PreviewDetailResponseSchema,
  PreviewListResponseSchema,
  PublicFormResponseSchema,
  type DeliveryEntry,
  type DeliveryListResponse,
  type PreviewEntry,
  type PublicFormResponse,
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
  /** フォームの定義（Form API。公開キーは使わない）。 */
  getForm(formKey: string): Promise<PublicFormResponse["form"]>;
}

/**
 * プレビューのトークンが無効・期限切れ（Preview API が 401）。
 * ページの一部だけを欠けさせず、middleware で「管理画面からもう一度開いてください」と表示する。
 */
export class PreviewTokenError extends CmsError {
  constructor(requestId: string | null = null) {
    super("Preview token is invalid or expired", 401, "UNAUTHORIZED", requestId);
    this.name = "PreviewTokenError";
  }
}

function listParams(query: ListQuery): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.sort !== undefined) params.set("sort", query.sort);
  for (const [key, value] of Object.entries(query.filter ?? {})) {
    params.set(`filter[${key}]`, value);
  }
  return params.size > 0 ? `?${params.toString()}` : "";
}

/** 認証・応答の検証・エラーの形をまとめた GET。 */
function createRequester(config: CmsClientConfig, extraHeaders: Record<string, string> = {}) {
  const doFetch = config.fetch ?? fetch;

  return async function request<T extends z.ZodType>(url: string, schema: T, auth = true): Promise<z.infer<T>> {
    const res = await doFetch(url, {
      headers: auth
        ? { Authorization: `${DELIVERY_AUTH_SCHEME} ${config.deliveryKey}`, Accept: "application/json", ...extraHeaders }
        : { Accept: "application/json" },
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
  };
}

async function nullIfNotFound<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof CmsError && err.status === 404) return null;
    throw err;
  }
}

export function createCmsClient(config: CmsClientConfig): CmsClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const root = `${baseUrl}/api/v1/delivery/${encodeURIComponent(config.siteKey)}`;
  const formsRoot = `${baseUrl}/api/v1/forms/${encodeURIComponent(config.siteKey)}`;
  const request = createRequester(config);

  return {
    async getSingleton(modelKey) {
      const res = await request(`${root}/singletons/${encodeURIComponent(modelKey)}`, DeliveryDetailResponseSchema);
      return res.data;
    },

    async getEntry(modelKey, slug) {
      return nullIfNotFound(async () => {
        const res = await request(
          `${root}/content/${encodeURIComponent(modelKey)}/${encodeURIComponent(slug)}`,
          DeliveryDetailResponseSchema,
        );
        return res.data;
      });
    },

    async getCollection(modelKey, query = {}) {
      return request(`${root}/content/${encodeURIComponent(modelKey)}${listParams(query)}`, DeliveryListResponseSchema);
    },

    async getForm(formKey) {
      const res = await request(`${formsRoot}/${encodeURIComponent(formKey)}`, PublicFormResponseSchema, false);
      return res.form;
    },
  };
}

// ---------------------------------------------------------------------------
// Preview API (ADR-028 / CMS docs/04 §19)
// ---------------------------------------------------------------------------

/**
 * 下書きの 1 件を、Delivery の形に寄せる（mapper を共用するため）。
 * 未公開の Entry は publishedAt が null なので、下書きの保存日時で代える（並び順を公開時に近づける）。
 */
export function previewToDeliveryEntry(entry: PreviewEntry): DeliveryEntry {
  return {
    id: entry.id,
    slug: entry.slug,
    content: entry.content,
    publishedAt: entry.publishedAt ?? entry.updatedAt,
    updatedAt: entry.updatedAt,
  };
}

export interface PreviewCmsClient extends CmsClient {
  readonly preview: true;
  /** slug が変わった下書きでも開けるよう、ID で 1 件取得する。 */
  getEntryById(modelKey: string, entryId: string): Promise<DeliveryEntry | null>;
}

/**
 * 下書きを読むクライアント。公開キーとプレビューのトークンの両方を送る。
 * 応答は Preview の契約（`preview: true`）で検証してから Delivery の形に寄せる。
 * フォームの定義は公開中のもの（Form API）を読む。
 */
export function createPreviewClient(config: CmsClientConfig, token: string): PreviewCmsClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const root = `${baseUrl}/api/v1/preview/${encodeURIComponent(config.siteKey)}`;
  const delivery = createCmsClient(config);
  const raw = createRequester(config, { [PREVIEW_TOKEN_HEADER]: token });

  const request: typeof raw = async (url, schema, auth) => {
    try {
      return await raw(url, schema, auth);
    } catch (err) {
      if (err instanceof CmsError && err.status === 401) throw new PreviewTokenError(err.requestId);
      throw err;
    }
  };

  return {
    preview: true,

    async getSingleton(modelKey) {
      const res = await request(`${root}/singletons/${encodeURIComponent(modelKey)}`, PreviewDetailResponseSchema);
      return previewToDeliveryEntry(res.data);
    },

    async getEntry(modelKey, slug) {
      return nullIfNotFound(async () => {
        const res = await request(
          `${root}/content/${encodeURIComponent(modelKey)}/${encodeURIComponent(slug)}`,
          PreviewDetailResponseSchema,
        );
        return previewToDeliveryEntry(res.data);
      });
    },

    async getEntryById(modelKey, entryId) {
      return nullIfNotFound(async () => {
        const res = await request(
          `${root}/entries/${encodeURIComponent(modelKey)}/${encodeURIComponent(entryId)}`,
          PreviewDetailResponseSchema,
        );
        return previewToDeliveryEntry(res.data);
      });
    },

    async getCollection(modelKey, query = {}) {
      const res = await request(`${root}/content/${encodeURIComponent(modelKey)}${listParams(query)}`, PreviewListResponseSchema);
      return { data: res.data.map(previewToDeliveryEntry), meta: res.meta };
    },

    getForm: (formKey) => delivery.getForm(formKey),
  };
}
