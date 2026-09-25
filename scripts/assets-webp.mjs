/**
 * src/assets/ にある PNG を WebP（可逆）に変換し、元の PNG を削除する。
 *
 * トップページは SSR のため、手元の画像はビルド時に最適化されず、置いたファイルがそのまま配信される。
 * そのため素材は事前に WebP にし、表示サイズの 2 倍程度に縮めておく。
 *
 * 使い方: 差し替える画像を同じ名前の .png で置いてから `pnpm assets:webp`
 *   例) src/assets/headings/topics.png を置く → topics.webp が置き換わる
 */
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../src/assets/", import.meta.url));

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.toLowerCase().endsWith(".png")) yield path;
  }
}

let count = 0;
for await (const png of walk(ROOT)) {
  const webp = png.replace(/\.png$/i, ".webp");
  await sharp(png).webp({ lossless: true, effort: 6 }).toFile(webp);
  await rm(png);
  console.log(`converted: ${webp}`);
  count++;
}
console.log(count === 0 ? "No PNG found in src/assets." : `Done (${count} files).`);
