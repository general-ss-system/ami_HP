/**
 * 静的書き出しから、表示にしていないページ（管理画面のページの表示設定）を取り除く。
 * ページは本文の代わりに目印だけを書き出している（src/lib/deploy/hidden-pages.ts）。
 * 取り除いた後に空になったフォルダも消す（/recruit/ などを Xserver に残さない）。
 */
import { readFileSync, readdirSync, rmSync, rmdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { isHiddenPageHtml } from "../../src/lib/deploy/hidden-pages.ts";

/** 取り除いたファイルの、dist からの相対パスを返す。 */
export function removeHiddenPages(dist) {
  const removed = [];
  for (const name of readdirSync(dist, { recursive: true })) {
    const path = join(dist, String(name));
    if (!path.endsWith(".html") || !statSync(path).isFile()) continue;
    if (!isHiddenPageHtml(readFileSync(path, "utf8"))) continue;
    rmSync(path);
    removed.push(relative(dist, path).split(sep).join("/"));
    // 空になったフォルダを、dist の手前まで消す
    for (let dir = dirname(path); dir !== dist && dir.startsWith(dist); dir = dirname(dir)) {
      if (readdirSync(dir).length > 0) break;
      rmdirSync(dir);
    }
  }
  return removed;
}
