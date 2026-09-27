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

/**
 * rich_text の配信形式（Lexical の JSON / CMS docs/02 §5.3）。
 * ここでは外形だけを見る。中のノードは richtext.ts が許可したものだけ描画する。
 */
export const RichTextSchema = z.object({ root: z.looseObject({ type: z.literal("root") }) });
const optionalRichText = RichTextSchema.nullable().optional();

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
  /** SERVICE ページの本文。 */
  body: optionalRichText,
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
  /** 詳細ページの本文。 */
  body: optionalRichText,
  /** 設定されていればカードから直接この URL を開く（詳細ページは使わない）。 */
  external_url: optionalLink,
  /** TOPICS 一覧の「Pick UP!」に出す（boolean・indexed）。 */
  pickup: z.boolean().nullable().optional(),
});

// ---------------------------------------------------------------------------
// members（collection、CMS の汎用モデル）: Member
// ---------------------------------------------------------------------------

export const MemberContentSchema = z.object({
  name: z.string().min(1),
  role: optionalText,
  portrait: optionalMedia,
  /** MEMBER ページの紹介文（改行あり）。 */
  profile: optionalText,
  sort_order: z.number().int().nullable().optional(),
  // ---- MEMBER ページのプロフィール（2026-09-27 追加。CMS の members にも足す） ----
  /** 生年月日（date: YYYY-MM-DD） */
  birthday: optionalText,
  hometown: optionalText,
  /** 身長（例: 165cm） */
  height: optionalText,
  mbti: optionalText,
  personal_color: optionalText,
  /** SNS。label にアカウント名（例: @ricoyamada）、href に URL */
  instagram: optionalLink,
  x: optionalLink,
  tiktok: optionalLink,
  /** プロフィール写真（証明写真のように 2×2 で並べる。最大 4 枚） */
  photos: z.array(DeliveryMediaSchema).nullable().optional(),
});

// ---------------------------------------------------------------------------
// works（collection、CMS の汎用モデル）: WORKS
// ---------------------------------------------------------------------------

/** タグの値（CMS の works.tags の選択肢）。表示名は lib/works.ts。 */
export const WORK_TAGS = ["branding", "web", "graphic", "movie"] as const;

export const WorkContentSchema = z.object({
  title: z.string().min(1),
  client_name: optionalText,
  summary: optionalText,
  published_date: optionalText,
  /** 選択肢に無い値は mapper で読み飛ばす（CMS 側で選択肢が増えてもページを壊さない）。 */
  tags: z.array(z.string()).nullable().optional(),
  thumbnail: optionalMedia,
  gallery: z.array(DeliveryMediaSchema).nullable().optional(),
  body: optionalRichText,
  external_url: optionalLink,
});

// ---------------------------------------------------------------------------
// site_info（singleton、CMS の汎用モデル）: 会社名・SEO の既定値
// ---------------------------------------------------------------------------

export const SiteInfoContentSchema = z.object({
  company_name: z.string().min(1),
  address: optionalText,
  phone: optionalText,
  email: optionalText,
  instagram_url: optionalLink,
  x_url: optionalLink,
  default_title: optionalText,
  /** 例: `%s | 合同会社ami` */
  title_template: optionalText,
  default_description: optionalText,
  default_og_image: optionalMedia,
});

// ---------------------------------------------------------------------------
// about（singleton、CMS の汎用モデル）: ABOUT ページ・会社概要
// ---------------------------------------------------------------------------

export const AboutContentSchema = z.object({
  lead: optionalText,
  body: optionalRichText,
  main_image: optionalMedia,
  representative: optionalText,
  established: optionalText,
  capital: optionalText,
  business_summary: optionalText,
});

// ---------------------------------------------------------------------------
// contact_page（singleton、CMS の汎用モデル）: CONTACT ページ
// ---------------------------------------------------------------------------

export const ContactPageContentSchema = z.object({
  lead: optionalText,
  /** 個人情報の取り扱い。 */
  privacy_note: optionalRichText,
  /** 同意チェックの文言。 */
  consent_label: optionalText,
});

// ---------------------------------------------------------------------------
// recruit（singleton、CMS の汎用モデル）: RECRUIT ページ
// ---------------------------------------------------------------------------

export const RecruitContentSchema = z.object({
  message_title: z.string().min(1),
  message_body: optionalRichText,
  main_image: optionalMedia,
  /** 職場写真（最大 12 枚）。 */
  gallery: z.array(DeliveryMediaSchema).nullable().optional(),
});

// ---------------------------------------------------------------------------
// job_positions（collection、CMS の汎用モデル）: 募集職種
// ---------------------------------------------------------------------------

/** 雇用形態の値（CMS の job_positions.employment_type の選択肢）。表示名は lib/recruit.ts。 */
export const EMPLOYMENT_TYPES = ["full_time", "contract", "part_time", "intern"] as const;

export const JobPositionContentSchema = z.object({
  title: z.string().min(1),
  employment_type: z.enum(EMPLOYMENT_TYPES),
  location: optionalText,
  summary: optionalText,
  description: RichTextSchema,
  /** false なら募集を締め切った職種（出さない）。未入力は募集中として扱う。 */
  is_open: z.boolean().nullable().optional(),
});

// ---------------------------------------------------------------------------
// faq（collection、CMS の汎用モデル）: よくある質問
// ---------------------------------------------------------------------------

export const FaqContentSchema = z.object({
  question: z.string().min(1),
  answer: RichTextSchema,
  sort_order: z.number().int().nullable().optional(),
});

export type AmiHomeContent = z.infer<typeof AmiHomeContentSchema>;
export type AmiServiceContent = z.infer<typeof AmiServiceContentSchema>;
export type AmiTopicContent = z.infer<typeof AmiTopicContentSchema>;
export type MemberContent = z.infer<typeof MemberContentSchema>;
export type WorkContent = z.infer<typeof WorkContentSchema>;
export type SiteInfoContent = z.infer<typeof SiteInfoContentSchema>;
export type AboutContent = z.infer<typeof AboutContentSchema>;
export type ContactPageContent = z.infer<typeof ContactPageContentSchema>;
