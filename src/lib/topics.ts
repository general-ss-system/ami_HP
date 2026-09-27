/**
 * TOPICS のサイト内 URL（一覧・分類・ページ送り・詳細）。ルーティングの形はここだけで決める。
 *
 *   /topics                         一覧（1 ページ目）
 *   /topics/page/{n}                一覧（2 ページ目以降）
 *   /topics/category/{c}            分類ごとの一覧
 *   /topics/category/{c}/page/{n}
 *   /topics/{slug}                  詳細
 */

import type { Topic, TopicCategory } from "./cms/types";
import { withBase } from "./url";

export const TOPIC_CATEGORY_LABEL: Record<TopicCategory, string> = {
  news: "NEWS",
  sns: "SNS",
  column: "COLUMN",
};

export function topicsListHref(category: TopicCategory | null, page = 1): string {
  const base = category ? `/topics/category/${category}` : "/topics";
  return withBase(page > 1 ? `${base}/page/${page}` : base);
}

/** カードのリンク先。外部リンクが設定されていればそれを、無ければ詳細ページ。 */
export function topicHref(topic: Topic): { href: string; external: boolean } {
  if (topic.externalLink) return { href: topic.externalLink.href, external: topic.externalLink.external };
  if (topic.slug) return { href: withBase(`/topics/${encodeURIComponent(topic.slug)}`), external: false };
  return { href: topicsListHref(null), external: false };
}

/** "2026-09-20" → "2026.09.20"（形が違えばそのまま） */
export function formatTopicDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : date;
}
