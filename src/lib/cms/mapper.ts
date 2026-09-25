/**
 * CMS の応答 → 画面用データの変換（CMS docs/04 §14）。
 *
 * 検証に失敗したエントリは例外にせず MapError として返す。
 * 1件の入力ミスでページ全体を壊さないため（CMS docs/04 §13）。
 */

import type { z } from "zod";
import type { DeliveryEntry, DeliveryMedia } from "./contracts";
import {
  AmiHomeContentSchema,
  AmiServiceContentSchema,
  AmiTopicContentSchema,
  MemberContentSchema,
  type CmsLinkSchema,
} from "./schemas";
import type { HomeContent, Link, Media, Member, Service, StatementLine, Topic } from "./types";
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

export function mapService(entry: DeliveryEntry): MapResult<Service> {
  const r = parseContent("ami_services", entry, AmiServiceContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: { id: entry.id, title: c.title, summary: c.summary ?? null, image: toMedia(c.image), link: toLink(c.link) },
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
    },
  };
}

export function mapMember(entry: DeliveryEntry): MapResult<Member> {
  const r = parseContent("members", entry, MemberContentSchema);
  if (!r.ok) return r;
  const c = r.value;
  return {
    ok: true,
    value: { id: entry.id, name: c.name, role: c.role ?? null, portrait: toMedia(c.portrait) },
  };
}
