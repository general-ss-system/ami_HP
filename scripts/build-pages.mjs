/**
 * GitHub Pages 用のプレビューをビルドする（仮データで静的に書き出す）。
 * Windows でも動くよう、環境変数の設定を Node 側で行う。
 * pnpm が PATH に無い環境（corepack 経由で使う場合など）でも動くよう、astro を Node で直接起動する。
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { removeHiddenPages } from "./lib/remove-hidden-pages.mjs";

// package.json の bin（exports に無いパスは resolve できないため、package.json の場所から組み立てる）
const require = createRequire(import.meta.url);
const astroPkg = require.resolve("astro/package.json");
const astroBin = join(dirname(astroPkg), require(astroPkg).bin.astro);

const result = spawnSync(process.execPath, [astroBin, "build"], {
  stdio: "inherit",
  env: { ...process.env, PREVIEW_TARGET: "github-pages", CMS_MODE: "fixture" },
});
if (result.status === 0) {
  // 管理画面のページの表示設定（仮データ）で非表示のページは置かない
  const hidden = removeHiddenPages(join(dirname(fileURLToPath(import.meta.url)), "..", "dist"));
  if (hidden.length > 0) console.log(`非表示のページを除きました: ${hidden.join(", ")}`);
}
process.exit(result.status ?? 1);
