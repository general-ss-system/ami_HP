/**
 * 一覧のページ番号（TOPICS・WORKS 共通）。1 ページ目は /topics・/works に寄せ、/page/1 は作らない。
 */

/** 静的書き出し用: ページ番号 2..totalPages。 */
export function laterPages(totalPages: number): number[] {
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2);
}

/** URL のページ番号。"1" や数字でないものは null（1 ページ目は /topics に寄せる）。 */
export function parsePageParam(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 2 && n <= 10_000 ? n : null;
}
