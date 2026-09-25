/**
 * モデルごとの `content` の実行時検証（CMS docs/04 §13）。
 *
 * Delivery API の外枠（id / slug / publishedAt …）は contracts.ts が検証する。
 * ここでは `content` の中身を、CMS のフィールド key（snake_case）のまま検証する。
 * camelCase への変換は mapper.ts で行う。
 *
 * key と型は CMS 側の Content Model 定義（packages/content-schema の ami 用定義）と揃える。
 * 項目の追加・変更は CMS 側 → ここ → mapper → UI の順に行う。
 */

import { z } from "zod";
import { DeliveryMediaSchema } from "./contracts";

/** link フィールドの配信形式（CMS docs/02 §16）。 */
export const CmsLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
  target: z.enum(["_self", "_blank"]),
});

/** 任意項目: 未入力は null か、キー自体が無い。 */
const optionalText = z.string().nullable().optional();
const optionalMedia = DeliveryMediaSchema.nullable().optional();
const optionalLink = CmsLinkSchema.nullable().optional();

// ---------------------------------------------------------------------------
// ami_home（singleton）: トップページ
// ---------------------------------------------------------------------------

export const AmiHomeContentSchema = z.object({
  /** ヒーローに重ねて見せる写真（先頭が一番手前）。 */
  hero_images: z.array(DeliveryMediaSchema).min(1),
  /** 例: 何かに強く惹かれる瞬間。 */
  statement_lead: optionalText,
  /** 例: 憧れ。情熱。共鳴。熱望。 */
  statement_keywords: optionalText,
  /** 例: 「トキメキ」 */
  statement_title: optionalText,
  /** 改行で段落を分けた本文。 */
  statement_body: z.string().min(1),
  /** 本文の中で強調する語句（例: 「トキメキの発生点」）。本文に含まれていなければ強調しない。 */
  statement_highlight: optionalText,
  statement_link: optionalLink,
  /** Topics に並べる件数。 */
  topics_limit: z.number().int().min(1).max(12).nullable().optional(),
  /** お問い合わせへの誘導文（改行あり）。 */
  contact_body: optionalText,
});

// ---------------------------------------------------------------------------
// ami_services（collection）: Our Business
// ---------------------------------------------------------------------------

export const AmiServiceContentSchema = z.object({
  title: z.string().min(1),
  summary: optionalText,
  /** 背景を透過した商品・画面の画像。角丸の枠からはみ出して見せる。 */
  image: optionalMedia,
  link: optionalLink,
  sort_order: z.number().int().nullable().optional(),
});

// ---------------------------------------------------------------------------
// ami_topics（collection）: Topics
// ---------------------------------------------------------------------------

export const TOPIC_CATEGORIES = ["news", "sns", "column"] as const;

export const AmiTopicContentSchema = z.object({
  title: z.string().min(1),
  category: z.enum(TOPIC_CATEGORIES),
  thumbnail: optionalMedia,
  excerpt: optionalText,
  published_date: z.string().min(1),
});

// ---------------------------------------------------------------------------
// members（collection、CMS の汎用モデル）: Member
// ---------------------------------------------------------------------------

export const MemberContentSchema = z.object({
  name: z.string().min(1),
  role: optionalText,
  portrait: optionalMedia,
  sort_order: z.number().int().nullable().optional(),
});

export type AmiHomeContent = z.infer<typeof AmiHomeContentSchema>;
export type AmiServiceContent = z.infer<typeof AmiServiceContentSchema>;
export type AmiTopicContent = z.infer<typeof AmiTopicContentSchema>;
export type MemberContent = z.infer<typeof MemberContentSchema>;
