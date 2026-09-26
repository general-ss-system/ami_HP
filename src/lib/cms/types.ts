/**
 * 画面側で使うデータの型（CMS docs/04 §12 の `types`）。
 *
 * UI コンポーネントはこの型だけに依存し、CMS の応答の形（snake_case の key 等）を知らない。
 */

import type { RtBlock } from "./richtext";

export type { RtBlock };

export interface Media {
  url: string;
  /** null は装飾画像として扱う（alt=""）。 */
  alt: string | null;
  width: number | null;
  height: number | null;
}

export interface Link {
  label: string;
  href: string;
  external: boolean;
}

/** ステートメント本文の1行。強調部分を分けて持つ。 */
export interface StatementLine {
  before: string;
  highlight: string | null;
  after: string;
}

export interface HomeContent {
  heroImages: Media[];
  statement: {
    lead: string | null;
    keywords: string | null;
    title: string | null;
    /** 空文字は段落の区切り（空行）。 */
    lines: StatementLine[];
    link: Link | null;
  };
  topicsLimit: number;
  contactBody: string | null;
}

export interface Service {
  id: string;
  /** SERVICE ページのアンカー（#slug）に使う。 */
  slug: string | null;
  title: string;
  summary: string | null;
  image: Media | null;
  link: Link | null;
  /** SERVICE ページの本文。空なら []。 */
  body: RtBlock[];
}

export type TopicCategory = "news" | "sns" | "column";

export interface Topic {
  id: string;
  slug: string | null;
  title: string;
  category: TopicCategory;
  thumbnail: Media | null;
  excerpt: string | null;
  publishedDate: string;
  /** 設定されていれば、カードから直接この URL を開く。 */
  externalLink: Link | null;
}

export interface TopicDetail extends Topic {
  body: RtBlock[];
}

export interface Member {
  id: string;
  slug: string | null;
  name: string;
  role: string | null;
  portrait: Media | null;
  profile: string | null;
}

export interface SiteInfo {
  companyName: string;
  address: string | null;
  defaultTitle: string | null;
  titleTemplate: string | null;
  defaultDescription: string | null;
  defaultOgImage: Media | null;
}

export interface AboutContent {
  lead: string | null;
  body: RtBlock[];
  mainImage: Media | null;
  representative: string | null;
  established: string | null;
  capital: string | null;
  businessSummary: string | null;
}

export interface ContactPageContent {
  lead: string | null;
  privacyNote: RtBlock[];
  consentLabel: string | null;
}

export type FormFieldType = "text" | "textarea" | "email" | "tel" | "url" | "number" | "date" | "select" | "checkboxes" | "checkbox";

export interface FormField {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  helpText: string | null;
  options: { value: string; label: string }[] | null;
  maxLength: number | null;
}

/** Form API の定義（GET /api/v1/forms/{siteKey}/{formKey}）。 */
export interface ContactForm {
  key: string;
  acceptingSubmissions: boolean;
  consentRequired: boolean;
  consentTextVersion: string | null;
  fields: FormField[];
}

/** トップページに必要なデータ一式。取得・検証に失敗したセクションは null / 空配列になる。 */
export interface TopPageData {
  home: HomeContent | null;
  services: Service[];
  topics: Topic[];
  members: Member[];
}
