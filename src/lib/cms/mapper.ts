/**
 * CMS の応答 → 画面用データの変換（CMS docs/04 §14）。
 *
 * 検証に失敗したエントリは例外にせず MapError として返す。
 * 1件の入力ミスでページ全体を壊さないため（CMS docs/04 §13）。
 */

import type { z } from "zod";
import type { DeliveryEntry, DeliveryMedia } from "./contracts";
import {
  AboutContentSchema,
  AmiHomeContentSchema,
  AmiServiceContentSchema,
  AmiTopicContentSchema,
  ContactPageContentSchema,
  MemberContentSchema,
  SiteInfoContentSchema,
  type CmsLinkSchema,
} from "./schemas";
import { toRichText, type RichTextReporter } from "./richtext";
import type {
  AboutContent,
  ContactPageContent,
  HomeContent,
  Link,
  Media,
  Member,
  Service,
  SiteInfo,
  StatementLine,
  Topic,
  TopicDetail,
} from "./types";
import { withBase } from "../url";

export const DEFAULT_TOPICS_LIMIT = 4;

export interface MapError {
  model: string;
  entryId: string;
  /** 失敗したフィールドの key（例: "hero_images.0.url"）。 */
  fields: string[];
}

export type MapResult<T> = { ok: true; value: T } | { ok: false; error: MapError };

function parseContent<S extends z.ZodType>(model: string, entry: DeliveryEntry, schema: S): MapResult<z.infer<S>> {
  const parsed = schema.safeParse(entry.content);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    error: { model, entryId: entry.id, fields: parsed.error.issues.map((i) => i.path.join(".")) },
  };
}

export function toMedia(media: DeliveryMedia | null | undefined): Media | null {
  if (!media) return null;
  return { url: media.url, alt: media.alt, width: media.width, height: media.height };
}

export function toLink(link: z.infer<typeof CmsLinkSchema> | null | undefined): Link | null {
  if (!link) return null;
  return { label: link.label, href: withBase(link.href), external: link.target === "_blank" };
}

/** 本文を行に分け、強調語句を含む行はその部分を切り出す。 */
export function toStatementLines(body: string, highlight: string | null | undefined): StatementLine[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const at = highlight ? line.indexOf(highlight) : -1;
      if (!highlight || at < 0) return { before: line, highlight: null, after: "" };
      return { before: line.slice(0, at), highlight, after: line.slice(at + highlight.length) };
    });
}

export function mapHome(entry: DeliveryEntry): MapResult<HomeContent> {
  const r = parseContent("ami_home", entry, AmiHomeContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: {
      heroImages: c.hero_images.map((m) => toMedia(m)!),
      statement: {
        lead: c.statement_lead ?? null,
        keywords: c.statement_keywords ?? null,
        title: c.statement_title ?? null,
        lines: toStatementLines(c.statement_body, c.statement_highlight),
        link: toLink(c.statement_link),
      },
      topicsLimit: c.topics_limit ?? DEFAULT_TOPICS_LIMIT,
      contactBody: c.contact_body ?? null,
    },
  };
}

/** rich_text で飛ばしたノードを、どのエントリのどの項目か分かる形で報告する。 */
function richTextReporter(report: RichTextReporter | undefined, model: string, entry: DeliveryEntry, field: string) {
  return (message: string, detail: unknown) => report?.(message, { model, entryId: entry.id, field, detail });
}

export function mapService(entry: DeliveryEntry, report?: RichTextReporter): MapResult<Service> {
  const r = parseContent("ami_services", entry, AmiServiceContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: {
      id: entry.id,
      slug: entry.slug,
      title: c.title,
      summary: c.summary ?? null,
      image: toMedia(c.image),
      link: toLink(c.link),
      body: toRichText(c.body, richTextReporter(report, "ami_services", entry, "body")),
    },
  };
}

export function mapTopic(entry: DeliveryEntry): MapResult<Topic> {
  const r = parseContent("ami_topics", entry, AmiTopicContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: {
      id: entry.id,
      slug: entry.slug,
      title: c.title,
      category: c.category,
      thumbnail: toMedia(c.thumbnail),
      excerpt: c.excerpt ?? null,
      publishedDate: c.published_date,
      externalLink: toLink(c.external_url),
    },
  };
}

export function mapTopicDetail(entry: DeliveryEntry, report?: RichTextReporter): MapResult<TopicDetail> {
  const r = mapTopic(entry);
  if (!r.ok) return r;
  const body = (entry.content as { body?: unknown }).body;
  return { ok: true, value: { ...r.value, body: toRichText(body, richTextReporter(report, "ami_topics", entry, "body")) } };
}

export function mapMember(entry: DeliveryEntry): MapResult<Member> {
  const r = parseContent("members", entry, MemberContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: {
      id: entry.id,
      slug: entry.slug,
      name: c.name,
      role: c.role ?? null,
      portrait: toMedia(c.portrait),
      profile: c.profile ?? null,
    },
  };
}

export function mapSiteInfo(entry: DeliveryEntry): MapResult<SiteInfo> {
  const r = parseContent("site_info", entry, SiteInfoContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: {
      companyName: c.company_name,
      address: c.address ?? null,
      defaultTitle: c.default_title ?? null,
      titleTemplate: c.title_template ?? null,
      defaultDescription: c.default_description ?? null,
      defaultOgImage: toMedia(c.default_og_image),
    },
  };
}

export function mapAbout(entry: DeliveryEntry, report?: RichTextReporter): MapResult<AboutContent> {
  const r = parseContent("about", entry, AboutContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: {
      lead: c.lead ?? null,
      body: toRichText(c.body, richTextReporter(report, "about", entry, "body")),
      mainImage: toMedia(c.main_image),
      representative: c.representative ?? null,
      established: c.established ?? null,
      capital: c.capital ?? null,
      businessSummary: c.business_summary ?? null,
    },
  };
}

export function mapContactPage(entry: DeliveryEntry, report?: RichTextReporter): MapResult<ContactPageContent> {
  const r = parseContent("contact_page", entry, ContactPageContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: {
      lead: c.lead ?? null,
      privacyNote: toRichText(c.privacy_note, richTextReporter(report, "contact_page", entry, "privacy_note")),
      consentLabel: c.consent_label ?? null,
    },
  };
}
