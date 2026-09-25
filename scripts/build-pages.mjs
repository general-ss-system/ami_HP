/**
 * GitHub Pages 用のプレビューをビルドする（仮データで静的に書き出す）。
 * Windows でも動くよう、環境変数の設定を Node 側で行う。
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "astro", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, PREVIEW_TARGET: "github-pages", CMS_MODE: "fixture" },
});
process.exit(result.status ?? 1);
