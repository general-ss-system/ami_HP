/**
 * WORKS のサイト内 URL（一覧・タグ・ページ送り・詳細）。ルーティングの形はここだけで決める。
 *
 *   /works                     一覧（1 ページ目）
 *   /works/page/{n}            一覧（2 ページ目以降）
 *   /works/tag/{t}             タグごとの一覧
 *   /works/tag/{t}/page/{n}
 *   /works/{slug}              詳細
 */

import type { Work, WorkTag } from "./cms/types";
import { withBase } from "./url";

/** タグの表示名（CMS の works.tags の選択肢の label と同じ）。 */
export const WORK_TAG_LABEL: Record<WorkTag, string> = {
  branding: "ブランディング",
  web: "Web",
  graphic: "グラフィック",
  movie: "動画",
};

export function worksListHref(tag: WorkTag | null, page = 1): string {
  const base = tag ? `/works/tag/${tag}` : "/works";
  return withBase(page > 1 ? `${base}/page/${page}` : base);
}

export function workHref(work: Work): string {
  return work.slug ? withBase(`/works/${encodeURIComponent(work.slug)}`) : worksListHref(null);
}

/** "2026-09-20" → "2026.09" （実績は月まで）。形が違えばそのまま。 */
export function formatWorkDate(date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  return m ? `${m[1]}.${m[2]}` : date;
}
