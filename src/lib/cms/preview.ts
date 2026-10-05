/**
 * 下書きプレビュー（ADR-028 / CMS docs/04 §19）の共通処理。
 *
 * CMS の管理画面の「プレビュー」は、サイト設定に登録した URL
 *   https://<公開ドメイン>/api/preview?token={token}&model={model}&slug={slug}&entryId={entryId}
 * を新しいタブで開く。/api/preview はトークンを確かめてから httpOnly Cookie に移し、
 * 該当するページへ送る。以降は middleware が Cookie を読み、ページは Preview API から下書きを読む。
 * トークンを URL に載せたまま回遊させない（共有された瞬間に下書きが第三者へ渡るため）。
 */

import type { PreviewCmsClient } from "./client";
import type { DeliveryEntry } from "./contracts";
import { entryPath } from "./richtext";
import { withBase } from "../url";
import { OPTIONAL_SECTIONS } from "../../config/sections";

export const PREVIEW_COOKIE = "ami_preview_token";

/** Preview API のトークンは 1 時間で失効する。Cookie も同じ寿命にする。 */
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60;

/** プレビュー中の応答に付けるヘッダー（CDN・検索結果に下書きを残さない）。 */
export const PREVIEW_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

/** singleton → そのページ。ページを増やしたらここにも足す。 */
const SINGLETON_PATHS: Record<string, string> = {
  ami_home: "/",
  site_info: "/",
  about: "/about",
  contact_page: "/contact",
  recruit: "/recruit",
  ami_service_page: "/service",
};

/** 一覧ページ（slug が無いときの行き先）。 */
const COLLECTION_PATHS: Record<string, string> = {
  ami_topics: "/topics",
  ami_services: "/service",
  members: "/member",
  works: "/works",
  job_positions: "/recruit",
  faq: "/faq",
  ami_service_cases: "/service",
};

/** 公開していないページ（src/config/sections.ts）を出すモデル。プレビューの行き先が無い。 */
function hiddenModels(sections: Sections): Set<string> {
  return new Set([
    ...(sections.works ? [] : ["works"]),
    ...(sections.recruit ? [] : ["recruit", "job_positions"]),
    ...(sections.faq ? [] : ["faq"]),
  ]);
}

type Sections = { readonly works: boolean; readonly recruit: boolean; readonly faq: boolean };

/**
 * プレビューする内容 → サイト内のパス。ページが無いモデル・公開していないページのモデルは null。
 * 詳細ページ・アンカーの形は本文の内部リンク（richtext.ts の entryPath）と同じにする。
 */
export function resolvePreviewPath(model: string, slug: string | null, sections: Sections = OPTIONAL_SECTIONS): string | null {
  if (hiddenModels(sections).has(model)) return null;
  const singleton = SINGLETON_PATHS[model];
  if (singleton) return withBase(singleton);
  if (slug) {
    const path = entryPath({ id: "", model, slug }, sections);
    if (path) return path;
  }
  const list = COLLECTION_PATHS[model];
  return list ? withBase(list) : null;
}

/**
 * プレビューする下書きを読む。
 *
 * 管理画面は singleton（トップページなど）でも entryId を付けて開くが、CMS の
 * `entries/{model}/{entryId}` は collection 専用で、singleton には 404 を返す。
 * そのため singleton は entryId があっても `singletons/{model}` で読む。
 */
export async function loadPreviewEntry(
  client: PreviewCmsClient,
  params: { model: string; slug: string | null; entryId: string | null },
): Promise<DeliveryEntry | null> {
  const { model, slug, entryId } = params;
  if (model in SINGLETON_PATHS) return client.getSingleton(model);
  if (entryId) return client.getEntryById(model, entryId);
  if (slug) return client.getEntry(model, slug);
  return client.getSingleton(model);
}

/**
 * プレビューの行き先を決めるための slug。詳細ページを持たない記事は null（一覧へ送る）。
 * 外部リンクを設定したトピックスはカードから外部サイトを開くだけで、詳細ページは 404 になるため。
 */
export function previewTargetSlug(model: string, entry: DeliveryEntry): string | null {
  if (model === "ami_topics") {
    const link = (entry.content as Record<string, unknown>).external_url;
    if (link && typeof link === "object" && typeof (link as { href?: unknown }).href === "string" && (link as { href: string }).href) {
      return null;
    }
  }
  return entry.slug;
}

/** /api/preview-exit?to=... の戻り先。サイト内のパスだけを受け付ける（オープンリダイレクトにしない）。 */
export function safeReturnPath(requested: string | null): string {
  if (requested && requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/\\")) {
    return requested;
  }
  return withBase("/");
}

export function previewCookieOptions(isHttps: boolean) {
  return {
    path: withBase("/"),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    maxAge: PREVIEW_COOKIE_MAX_AGE,
  };
}
