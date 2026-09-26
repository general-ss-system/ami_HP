/**
 * rich_text（Lexical の JSON / CMS docs/02 §5.3, docs/04 §17）→ 画面で描画する安全な木。
 *
 * - 許可したノードだけを変換する。未知のノードはそこだけ飛ばして報告する（ページ全体は壊さない）。
 * - リンクは http(s) / mailto / tel / サイト内パスだけを通す。
 * - 見出しの h1 はページの h1 と重ならないよう h2 に下げる。
 * - 内部リンク（entry 参照）は公開中ならサイト内のパスに、未公開（null）なら文字だけにする。
 *
 * HTML 文字列は作らない。描画は RichText.astro がこの木をたどって行う。
 */

import { DeliveryMediaSchema, type DeliveryEntryRef } from "./contracts";
import { toMedia } from "./mapper";
import type { Media } from "./types";
import { withBase } from "../url";

export interface RtText {
  kind: "text";
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
}

export interface RtBreak {
  kind: "break";
}

export interface RtLink {
  kind: "link";
  href: string;
  external: boolean;
  children: RtInline[];
}

export type RtInline = RtText | RtBreak | RtLink;

export interface RtListItem {
  children: RtInline[];
  /** 入れ子のリスト */
  lists: RtList[];
}

export interface RtList {
  kind: "list";
  ordered: boolean;
  items: RtListItem[];
}

export type RtBlock =
  | { kind: "paragraph"; children: RtInline[] }
  | { kind: "heading"; level: 2 | 3 | 4; children: RtInline[] }
  | { kind: "quote"; children: RtInline[] }
  | { kind: "code"; text: string }
  | { kind: "image"; media: Media }
  | { kind: "rule" }
  | RtList;

export type RichTextReporter = (message: string, detail: unknown) => void;

type Node = Record<string, unknown>;

// Lexical の text.format（ビットフラグ）
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_STRIKE = 4;
const FORMAT_UNDERLINE = 8;
const FORMAT_CODE = 16;

function isNode(v: unknown): v is Node {
  return typeof v === "object" && v !== null && !Array.isArray(v) && typeof (v as Node).type === "string";
}

function childrenOf(node: Node): Node[] {
  return Array.isArray(node.children) ? node.children.filter(isNode) : [];
}

/** 通してよい URL だけを返す。それ以外は null（リンクを外して文字だけ表示する）。 */
export function sanitizeHref(raw: unknown): { href: string; external: boolean } | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (url === "") return null;
  if (url.startsWith("/") && !url.startsWith("//")) return { href: withBase(url), external: false };
  if (url.startsWith("#")) return { href: url, external: false };
  if (/^(mailto|tel):/i.test(url)) return { href: url, external: false };
  if (/^https?:\/\//i.test(url)) {
    try {
      return { href: new URL(url).toString(), external: true };
    } catch {
      return null;
    }
  }
  return null;
}

/** 内部リンクの参照先 → サイト内のパス。ページの無いモデルは null。 */
export function entryPath(ref: DeliveryEntryRef): string | null {
  if (!ref.slug) return null;
  const slug = encodeURIComponent(ref.slug);
  switch (ref.model) {
    case "ami_topics":
      return withBase(`/topics/${slug}`);
    case "ami_services":
      return withBase(`/service#${slug}`);
    case "members":
      return withBase(`/member#${slug}`);
    default:
      return null;
  }
}

function isEntryRef(v: unknown): v is DeliveryEntryRef {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.model === "string" && (typeof r.slug === "string" || r.slug === null);
}

export function toRichText(value: unknown, report: RichTextReporter = () => {}): RtBlock[] {
  const root = (value as { root?: unknown } | null | undefined)?.root;
  if (!isNode(root)) return [];

  const skip = (node: Node) => report("unsupported rich text node", { type: node.type });

  function inlines(nodes: Node[]): RtInline[] {
    const out: RtInline[] = [];
    for (const n of nodes) {
      switch (n.type) {
        case "text": {
          const text = typeof n.text === "string" ? n.text : "";
          if (text === "") break;
          const format = typeof n.format === "number" ? n.format : 0;
          out.push({
            kind: "text",
            text,
            bold: (format & FORMAT_BOLD) !== 0,
            italic: (format & FORMAT_ITALIC) !== 0,
            strike: (format & FORMAT_STRIKE) !== 0,
            underline: (format & FORMAT_UNDERLINE) !== 0,
            code: (format & FORMAT_CODE) !== 0,
          });
          break;
        }
        case "linebreak":
          out.push({ kind: "break" });
          break;
        case "tab":
          out.push({ kind: "text", text: "\t", bold: false, italic: false, strike: false, underline: false, code: false });
          break;
        case "link": {
          const children = inlines(childrenOf(n));
          let target: { href: string; external: boolean } | null = null;
          if ("entry" in n) {
            const path = isEntryRef(n.entry) ? entryPath(n.entry) : null;
            target = path ? { href: path, external: false } : null;
          } else {
            target = sanitizeHref(n.url);
          }
          if (target) out.push({ kind: "link", ...target, children });
          else out.push(...children);
          break;
        }
        default:
          skip(n);
      }
    }
    return out;
  }

  function list(node: Node): RtList {
    const items: RtListItem[] = [];
    for (const item of childrenOf(node)) {
      if (item.type !== "listitem") {
        skip(item);
        continue;
      }
      const kids = childrenOf(item);
      const nested = kids.filter((k) => k.type === "list");
      // 入れ子のリストだけを持つ項目は、直前の項目の子にする（Lexical の入れ子の表し方）
      if (nested.length > 0 && nested.length === kids.length && items.length > 0) {
        items[items.length - 1]!.lists.push(...nested.map(list));
        continue;
      }
      items.push({ children: inlines(kids.filter((k) => k.type !== "list")), lists: nested.map(list) });
    }
    return { kind: "list", ordered: node.listType === "number", items };
  }

  const blocks: RtBlock[] = [];
  for (const n of childrenOf(root)) {
    switch (n.type) {
      case "paragraph":
        blocks.push({ kind: "paragraph", children: inlines(childrenOf(n)) });
        break;
      case "heading": {
        const tag = typeof n.tag === "string" ? n.tag : "h2";
        const level = Number(tag.slice(1));
        blocks.push({ kind: "heading", level: level <= 2 ? 2 : level === 3 ? 3 : 4, children: inlines(childrenOf(n)) });
        break;
      }
      case "quote":
        blocks.push({ kind: "quote", children: inlines(childrenOf(n)) });
        break;
      case "code":
        blocks.push({
          kind: "code",
          text: childrenOf(n)
            .map((c) => (c.type === "linebreak" ? "\n" : typeof c.text === "string" ? c.text : ""))
            .join(""),
        });
        break;
      case "list":
        blocks.push(list(n));
        break;
      case "image": {
        const media = DeliveryMediaSchema.safeParse(n.media);
        if (media.success) blocks.push({ kind: "image", media: toMedia(media.data)! });
        else skip(n);
        break;
      }
      case "horizontalrule":
        blocks.push({ kind: "rule" });
        break;
      default:
        skip(n);
    }
  }
  return blocks;
}

/** 本文が実質的に空か（空の段落だけ、など）。 */
export function isEmptyRichText(blocks: RtBlock[]): boolean {
  return blocks.every((b) => b.kind === "paragraph" && b.children.length === 0);
}
