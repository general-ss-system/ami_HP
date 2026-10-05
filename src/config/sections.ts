/**
 * 今回の公開に含めない下層ページの出し入れ（2026-10-05、先方の要件に入っていないため非公開）。
 *
 * false のページは、ページそのもの（src/optional-pages/）を登録しない（404・静的書き出しにも出ない）。
 * あわせて、フッターのナビ・サイトマップ・下書きプレビューの行き先・本文中の内部リンクからも外す。
 * 希望があれば true に戻してビルドし直すだけで復活する。CMS のデータ（実績・採用・FAQ）は消していない。
 *
 * astro.config.mjs からも読み込むため、このファイルは他のモジュールを import しない。
 */
export const OPTIONAL_SECTIONS = {
  /** WORKS（実績の一覧・詳細） */
  works: false,
  /** RECRUIT（採用ページ・募集職種） */
  recruit: false,
  /** FAQ（よくある質問） */
  faq: false,
} as const satisfies Record<string, boolean>;
