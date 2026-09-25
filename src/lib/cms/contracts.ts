/**
 * Delivery / Preview / Form API の応答の型（CMS との契約）。
 *
 * このファイルは CMS リポジトリ（ss-hp-public-system）の
 * `packages/contracts/src/index.ts` の写し。手で書き換えない。
 * 写した時点のコミット: 233726b
 * CMS 側で契約が変わったら、丸ごと写し直してコミットを更新する。
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 展開済みの参照 (docs/02 §5.4 / §5.6, ADR-007)
// ---------------------------------------------------------------------------

/** media フィールドの配信形式。保存形式（ID参照）とは別物。 */
export const DeliveryMediaSchema = z.strictObject({
  id: z.string(),
  url: z.string(),
  alt: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  mimeType: z.string(),
});

/**
 * relation の配信形式。
 *
 * 参照先の本文までは展開しない（無制限な再帰展開を許可しない / docs/02 §5.6）。
 * 参照先が未公開・削除済みの場合は null になる。存在を漏らさないため。
 */
export const DeliveryEntryRefSchema = z.strictObject({
  id: z.string(),
  model: z.string(),
  slug: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export const DeliveryEntrySchema = z.strictObject({
  id: z.string(),
  slug: z.string().nullable(),
  /** フィールドkey → 値。モデルごとの型は Frontend 側の契約型で絞る (docs/02 §16)。 */
  content: z.record(z.string(), z.unknown()),
  /** 最初に公開された日時。 */
  publishedAt: z.string().datetime(),
  /** 公開面が最後に更新された日時。下書きの保存では変わらない。 */
  updatedAt: z.string().datetime(),
});

export const PaginationMetaSchema = z.strictObject({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

/** GET /api/v1/delivery/{siteKey}/content/{modelKey} */
export const DeliveryListResponseSchema = z.strictObject({
  data: z.array(DeliveryEntrySchema),
  meta: PaginationMetaSchema,
});

/**
 * GET /api/v1/delivery/{siteKey}/content/{modelKey}/{slug}
 * GET /api/v1/delivery/{siteKey}/singletons/{modelKey}
 */
export const DeliveryDetailResponseSchema = z.strictObject({
  data: DeliveryEntrySchema,
});

// ---------------------------------------------------------------------------
// Preview API (ADR-028)
//
// 下書き面を返す。Delivery API とは別の口・別の形にし、取り違えられないようにする。
// `preview: true` を必ず含むので、Frontend は「未公開」の表示を出す判断に使う。
// ---------------------------------------------------------------------------

export const PreviewEntrySchema = z.strictObject({
  id: z.string(),
  slug: z.string().nullable(),
  /** 公開の状態。draft / scheduled なら、まだサイトに出ていない。 */
  status: z.enum(["draft", "scheduled", "published"]),
  content: z.record(z.string(), z.unknown()),
  /** 最初に公開された日時。未公開なら null。 */
  publishedAt: z.string().datetime().nullable(),
  /** 公開予定日時。予約していなければ null。 */
  scheduledAt: z.string().datetime().nullable(),
  /** 下書きが最後に保存された日時。 */
  updatedAt: z.string().datetime(),
});

/**
 * GET /api/v1/preview/{siteKey}/content/{modelKey}/{slug}
 * GET /api/v1/preview/{siteKey}/entries/{modelKey}/{entryId}
 * GET /api/v1/preview/{siteKey}/singletons/{modelKey}
 */
export const PreviewDetailResponseSchema = z.strictObject({
  preview: z.literal(true),
  data: PreviewEntrySchema,
});

/** GET /api/v1/preview/{siteKey}/content/{modelKey} */
export const PreviewListResponseSchema = z.strictObject({
  preview: z.literal(true),
  data: z.array(PreviewEntrySchema),
  meta: PaginationMetaSchema,
});

/** プレビュー用トークンを渡すヘッダ。公開キー（Authorization）と両方が必要。 */
export const PREVIEW_TOKEN_HEADER = "X-Preview-Token";

// ---------------------------------------------------------------------------
// Form API (docs/02 §10, ADR-015)
//
// Frontend のフォーム実装が送る形と、受け取る形。
// 受理する項目（fields の中身）はフォームごとに @ss/content-schema の定義が正本。
// ---------------------------------------------------------------------------

export const FormSubmissionRequestSchema = z.strictObject({
  /** 項目key → 値。定義に無い項目は拒否される。 */
  fields: z.record(z.string(), z.unknown()),
  /** 同意を求めるフォームでは true が必須。 */
  consent: z.boolean().optional(),
  /** 画面に表示した同意文の版。サーバの現在の版と違えば送信を拒否する。 */
  consentTextVersion: z.string().max(100).optional(),
  /** Turnstile ウィジェットが発行したトークン。 */
  turnstileToken: z.string().min(1, "ボット対策の確認が必要です").max(2048),
});

/** 送信内容も受付IDも返さない（個人情報を応答に載せない）。 */
export const FormSubmissionAcceptedSchema = z.strictObject({
  status: z.literal("accepted"),
});

export const PublicFormFieldSchema = z.strictObject({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "email", "tel", "url", "number", "date", "select", "checkboxes", "checkbox"]),
  required: z.boolean(),
  helpText: z.string().nullable(),
  options: z.array(z.strictObject({ value: z.string(), label: z.string() })).nullable(),
  maxLength: z.number().int().nullable(),
});

export const PublicFormResponseSchema = z.strictObject({
  form: z.strictObject({
    key: z.string(),
    name: z.string(),
    acceptingSubmissions: z.boolean(),
    consentRequired: z.boolean(),
    consentTextVersion: z.string().nullable(),
    fields: z.array(PublicFormFieldSchema),
  }),
});

/** 送信本文の上限（バイト）。 */
export const FORM_BODY_MAX_BYTES = 64 * 1024;

// ---------------------------------------------------------------------------
// エラー (docs/02 §11)
// ---------------------------------------------------------------------------

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "CONFIG_ERROR",
  "INTERNAL_ERROR",
]);

export const ErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z
      .array(z.strictObject({ field: z.string(), reason: z.string() }))
      .optional(),
  }),
});

// ---------------------------------------------------------------------------

export type DeliveryMedia = z.infer<typeof DeliveryMediaSchema>;
export type DeliveryEntryRef = z.infer<typeof DeliveryEntryRefSchema>;
export type DeliveryEntry = z.infer<typeof DeliveryEntrySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type DeliveryListResponse = z.infer<typeof DeliveryListResponseSchema>;
export type DeliveryDetailResponse = z.infer<typeof DeliveryDetailResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type FormSubmissionRequest = z.infer<typeof FormSubmissionRequestSchema>;
export type PublicFormResponse = z.infer<typeof PublicFormResponseSchema>;
export type PreviewEntry = z.infer<typeof PreviewEntrySchema>;
export type PreviewDetailResponse = z.infer<typeof PreviewDetailResponseSchema>;
export type PreviewListResponse = z.infer<typeof PreviewListResponseSchema>;

// ---------------------------------------------------------------------------
// Query の約束事 (docs/02 §8.4)
// ---------------------------------------------------------------------------

/** 1ページの上限。これを超える limit は 400。 */
export const DELIVERY_MAX_LIMIT = 100;
export const DELIVERY_DEFAULT_LIMIT = 20;
/** 一度に指定できる filter の数。 */
export const DELIVERY_MAX_FILTERS = 5;
/** offset の上限。深いページングは全件走査に近づくため拒否する。 */
export const DELIVERY_MAX_OFFSET = 10_000;
/** 公開キーを載せるヘッダ。`Authorization: Bearer <key>` (ADR-017)。 */
export const DELIVERY_AUTH_SCHEME = "Bearer";
