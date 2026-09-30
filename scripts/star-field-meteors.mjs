/**
 * 背景の星（src/assets/backgrounds/star-field.svg）から流れ星の 2 本を取り出す。
 *   star-field-still.svg … 流れ星を除いた星（背景に敷き詰める）
 *   meteor-a.svg / meteor-b.svg … 流れ星 1 本ずつ（ShootingStars が、ランダムな場所・向き・間隔で流す）
 *   meteors.json … 流れ星の大きさと、流れる向き（尾から頭へ）
 * star-field.svg はそのまま残す（prefers-reduced-motion のときに、動かない流れ星ごと出す）。
 *
 * 実行: node scripts/star-field-meteors.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../src/assets/backgrounds/", import.meta.url);
const src = readFileSync(new URL("star-field.svg", dir), "utf8");

const head = src.slice(0, src.indexOf("<g"));
const groupOpen = src.match(/<g[^>]*>/)[0];
const rects = [...src.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*\/>/g)].map((m) => ({
  tag: m[0],
  x: +m[1],
  y: +m[2],
  w: +m[3],
  h: +m[4],
}));

// 流れ星の範囲（デザイン上の px）と、流れる向き（尾から頭へ）
const meteors = [
  { id: "a", box: [940, 190, 1090, 350], dir: [-100, 117] },
  { id: "b", box: [200, 640, 290, 730], dir: [57, 64] },
];
const inBox = (r, [x0, y0, x1, y1]) => r.x >= x0 && r.x <= x1 && r.y >= y0 && r.y <= y1;

const still = rects.filter((r) => !meteors.some((m) => inBox(r, m.box)));
writeFileSync(new URL("star-field-still.svg", dir), `${head}${groupOpen}${still.map((r) => r.tag).join("")}</g></svg>`);

const round = (n) => Math.round(n * 10) / 10;
const info = meteors.map(({ id, box, dir: [dx, dy] }) => {
  const own = rects.filter((r) => inBox(r, box));
  const x0 = Math.min(...own.map((r) => r.x));
  const y0 = Math.min(...own.map((r) => r.y));
  const width = round(Math.max(...own.map((r) => r.x + r.w)) - x0);
  const height = round(Math.max(...own.map((r) => r.y + r.h)) - y0);
  // 不透明度は流すときに決めるので、ここでは付けない
  const body = own.map((r) => r.tag.replace(/x="[\d.]+" y="[\d.]+"/, `x="${round(r.x - x0)}" y="${round(r.y - y0)}"`)).join("");
  writeFileSync(
    new URL(`meteor-${id}.svg`, dir),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>`,
  );
  const len = Math.hypot(dx, dy);
  return { id, width, height, dir: [Math.round((dx / len) * 1000) / 1000, Math.round((dy / len) * 1000) / 1000] };
});
writeFileSync(new URL("meteors.json", dir), `${JSON.stringify(info, null, 2)}\n`);

console.log(`still: ${still.length} rects, meteors: ${info.map((m) => `${m.id} ${m.width}x${m.height}`).join(", ")}`);
