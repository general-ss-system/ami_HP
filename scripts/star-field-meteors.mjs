/**
 * 背景の星（src/assets/backgrounds/star-field.svg）から流れ星の 2 本を取り出し、流れる動きを付ける。
 *   star-field-still.svg   … 流れ星を除いた星（動かない）
 *   star-field-meteors.svg … 流れ星だけ。SVG の中の CSS で、線の向きに流れては消えるのを繰り返す
 * star-field.svg はそのまま残す（prefers-reduced-motion のときに、動かない流れ星ごと出す）。
 *
 * 実行: node scripts/star-field-meteors.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../src/assets/backgrounds/", import.meta.url);
const src = readFileSync(new URL("star-field.svg", dir), "utf8");

const head = src.slice(0, src.indexOf("<g"));
const groupOpen = src.match(/<g[^>]*>/)[0];
const rects = [...src.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"[^>]*\/>/g)].map((m) => ({ tag: m[0], x: +m[1], y: +m[2] }));

// 流れ星の範囲（デザイン上の px）と、流れる向き（尾から頭へ）
const meteors = [
  { id: "a", box: [940, 190, 1090, 350], dir: [-100, 117], duration: 7, delay: 0.6 },
  { id: "b", box: [200, 640, 290, 730], dir: [57, 64], duration: 9, delay: 3.8 },
];
const inBox = (r, [x0, y0, x1, y1]) => r.x >= x0 && r.x <= x1 && r.y >= y0 && r.y <= y1;

const still = rects.filter((r) => !meteors.some((m) => inBox(r, m.box)));
writeFileSync(new URL("star-field-still.svg", dir), `${head}${groupOpen}${still.map((r) => r.tag).join("")}</g></svg>`);

/*
 * 1 回の流れは周期の 15%（7 秒なら約 1 秒）。尾の方向へ 120px 戻したところから、頭の先へ 40px まで、
 * だんだん速く動かしながら、出始めで明るくし、終わりで消す。残りの時間は消えたまま待つ。
 */
const px = (n) => `${Math.round(n)}px`;
const css = meteors
  .map(({ id, dir: [dx, dy], duration, delay }) => {
    const len = Math.hypot(dx, dy);
    const [ux, uy] = [dx / len, dy / len];
    const from = `translate(${px(-ux * 120)}, ${px(-uy * 120)})`;
    const to = `translate(${px(ux * 40)}, ${px(uy * 40)})`;
    return [
      `.m-${id}{animation:fall-${id} ${duration}s cubic-bezier(.45,0,.9,.6) ${delay}s infinite}`,
      `@keyframes fall-${id}{0%{transform:${from};opacity:0}3%{opacity:1}11%{opacity:1}15%{transform:${to};opacity:0}100%{transform:${to};opacity:0}}`,
    ].join("");
  })
  .join("");

const groups = meteors
  .map((m) => `<g class="m-${m.id}" opacity="0">${rects.filter((r) => inBox(r, m.box)).map((r) => r.tag).join("")}</g>`)
  .join("");
writeFileSync(
  new URL("star-field-meteors.svg", dir),
  `${head}<style>${css}</style>${groupOpen}${groups}</g></svg>`,
);

console.log(`still: ${still.length} rects, meteors: ${rects.length - still.length} rects`);
