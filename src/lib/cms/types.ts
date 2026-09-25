/**
 * 画面側で使うデータの型（CMS docs/04 §12 の `types`）。
 *
 * UI コンポーネントはこの型だけに依存し、CMS の応答の形（snake_case の key 等）を知らない。
 */

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
  title: string;
  summary: string | null;
  image: Media | null;
  link: Link | null;
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
}

export interface Member {
  id: string;
  name: string;
  role: string | null;
  portrait: Media | null;
}

/** トップページに必要なデータ一式。取得・検証に失敗したセクションは null / 空配列になる。 */
export interface TopPageData {
  home: HomeContent | null;
  services: Service[];
  topics: Topic[];
  members: Member[];
}
