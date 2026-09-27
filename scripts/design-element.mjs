/**
 * デザインの SVG の、CSV（scripts/design-csv.mjs）の行番号の要素を、元の属性のまま表示する。
 * 角がドット絵の形になった枠などを、path の d をそのまま使って組むためのもの。
 *
 *   node scripts/design-element.mjs <svg> <index...>
 */

import fs from "node:fs";
import sax from "sax";

const [file, ...idx] = process.argv.slice(2);
const want = new Set(idx.map(Number));
const SHAPES = new Set(["rect", "path", "circle", "ellipse", "line", "image", "polygon", "polyline"]);
const HIDDEN = new Set(["defs", "mask", "clipPath", "pattern", "filter", "linearGradient", "radialGradient", "symbol"]);
const stack = [];
let hidden = 0;
let index = 0;
const parser = sax.parser(true);
parser.onopentag = (node) => {
  if (HIDDEN.has(node.name)) hidden++;
  if (hidden === 0 && SHAPES.has(node.name)) {
    index++;
    if (want.has(index)) {
      const groups = stack.filter((g) => Object.keys(g.attributes).length).map((g) => `<${g.name} ${Object.entries(g.attributes).map(([k, v]) => `${k}="${v}"`).join(" ")}>`);
      const attrs = Object.entries(node.attributes).map(([k, v]) => `${k}="${k === "href" || k === "xlink:href" ? String(v).slice(0, 40) + "…" : v}"`).join(" ");
      console.log(`#${index}${groups.length ? `\n  in: ${groups.join(" > ")}` : ""}\n  <${node.name} ${attrs}/>`);
    }
  }
  stack.push(node);
};
parser.onclosetag = (name) => { stack.pop(); if (HIDDEN.has(name)) hidden--; };
parser.write(fs.readFileSync(file, "utf8")).close();
