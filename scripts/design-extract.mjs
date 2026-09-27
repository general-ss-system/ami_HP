/**
 * デザインの SVG から、CSV（scripts/design-csv.mjs）の行番号で指定した要素だけを残して画像にする。
 * ドット絵の英字タイトルなど、文字が輪郭（path）になっている部品を、形を変えずに素材にするためのもの。
 *
 *   node scripts/design-extract.mjs <svg> <from-to[,from-to...]> <out.webp> [--scale 2] [--pad 4]
 *
 * 行番号は design/csv/<ページ>.csv の index と同じ数え方（defs・mask・clipPath の中を除いた図形の出現順）。
 * 元の SVG の構造（グループの transform・filter・mask・clip-path）はそのまま残し、指定していない図形だけを消して描く。
 * 背景は透明になり、描いたものの外接矩形に切り詰める。
 */

import fs from "node:fs";
import sax from "sax";
import sharp from "sharp";

const [file, rangesArg, out, ...rest] = process.argv.slice(2);
if (!file || !rangesArg || !out) {
  console.error("usage: node scripts/design-extract.mjs <svg> <from-to[,from-to...]> <out.webp> [--scale 2] [--pad 4]");
  process.exit(1);
}
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? Number(rest[i + 1]) : d; };
const scale = opt("scale", 2);
const pad = opt("pad", 4);
const ranges = rangesArg.split(",").map((r) => r.split("-").map(Number)).map(([a, b]) => [a, b ?? a]);
const wanted = (i) => ranges.some(([a, b]) => i >= a && i <= b);

const SHAPES = new Set(["rect", "path", "circle", "ellipse", "line", "image", "polygon", "polyline"]);
const HIDDEN = new Set(["defs", "mask", "clipPath", "pattern", "filter", "linearGradient", "radialGradient", "symbol"]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const text = fs.readFileSync(file, "utf8");
const outParts = [];
const hiddenDepth = []; // defs などの中にいるか
let skipDepth = 0; // 消す図形の中（子を含めて出さない）
let index = 0;
let kept = 0;

const parser = sax.parser(true);
parser.onopentag = (node) => {
  const inHidden = hiddenDepth.length > 0;
  if (skipDepth > 0) { skipDepth++; return; }
  if (!inHidden && SHAPES.has(node.name)) {
    index++;
    if (!wanted(index)) { skipDepth = 1; return; }
    kept++;
  }
  if (HIDDEN.has(node.name)) hiddenDepth.push(node.name);
  const attrs = Object.entries(node.attributes).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
  outParts.push(`<${node.name}${attrs}>`);
};
parser.onclosetag = (name) => {
  if (skipDepth > 0) { skipDepth--; return; }
  if (HIDDEN.has(name)) hiddenDepth.pop();
  outParts.push(`</${name}>`);
};
parser.ontext = (t) => { if (skipDepth === 0 && t.trim()) outParts.push(esc(t)); };
parser.oncdata = (t) => { if (skipDepth === 0) outParts.push(`<![CDATA[${t}]]>`); };
parser.write(text).close();

const svg = outParts.join("");
const { data, info } = await sharp(Buffer.from(svg), { density: 72 * scale, limitInputPixels: false, unlimited: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
if (x1 < 0) { console.error("描くものがありません（行番号を確かめてください）"); process.exit(1); }
const p = Math.round(pad * scale);
const left = Math.max(0, x0 - p), top = Math.max(0, y0 - p);
const width = Math.min(info.width, x1 + p + 1) - left, height = Math.min(info.height, y1 + p + 1) - top;
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left, top, width, height }).webp({ lossless: true }).toFile(out);
console.log(`${out}: ${kept} shapes, ${width}x${height}px (design ${Math.round(width / scale)}x${Math.round(height / scale)} at x=${Math.round(left / scale)} y=${Math.round(top / scale)})`);
