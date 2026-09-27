/**
 * Figma から書き出したデザインの SVG を、要素ごとの CSV にする（実装の精度を上げるための資料）。
 *
 *   node scripts/design-csv.mjs <svg...> [--out design/csv]
 *
 * 1 行 = 1 つの図形（rect / path / circle / ellipse / line / image）。変形（transform）を反映した、
 * ページ全体（1280px 幅）での位置と大きさを出す。Figma の書き出しでは文字が輪郭（path）になっているため、
 * 文字は「1 つのテキストレイヤー = 1 つの path」として、色と外接矩形だけが分かる（書体・字間は SVG に残らない）。
 *
 * 列: index, tag, x, y, width, height, rotate, fill, fill_opacity, stroke, stroke_width, rx, opacity,
 *     shadow（filter の drop-shadow: dx dy blur spread color）, blend, clip, kind
 *   kind: text?（細長く小さい単色 path。文字の可能性が高い）/ image / shape
 */

import fs from "node:fs";
import path from "node:path";
import sax from "sax";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : "design/csv";
const inputs = args.filter((a, i) => a !== "--out" && i !== outIdx + 1);
if (inputs.length === 0) {
  console.error("usage: node scripts/design-csv.mjs <svg...> [--out design/csv]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

// ---- 行列 [a b c d e f] ----
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function parseTransform(s) {
  let m = I;
  if (!s) return m;
  for (const [, fn, raw] of s.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = raw.split(/[\s,]+/).filter(Boolean).map(Number);
    let t = I;
    if (fn === "matrix") t = v;
    else if (fn === "translate") t = [1, 0, 0, 1, v[0], v[1] ?? 0];
    else if (fn === "scale") t = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else if (fn === "rotate") {
      const r = (v[0] * Math.PI) / 180;
      const rot = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
      t = v.length === 3 ? mul(mul([1, 0, 0, 1, v[1], v[2]], rot), [1, 0, 0, 1, -v[1], -v[2]]) : rot;
    }
    m = mul(m, t);
  }
  return m;
}

// ---- path の点（制御点を含む。曲線の外接矩形はやや大きめになる） ----
function pathPoints(d) {
  const pts = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z") { x = sx; y = sy; continue; }
    if (C === "M" || C === "L" || C === "T") { x = ox + num(); y = oy + num(); pts.push([x, y]); if (C === "M") { sx = x; sy = y; cmd = rel ? "l" : "L"; } }
    else if (C === "H") { x = ox + num(); pts.push([x, y]); }
    else if (C === "V") { y = oy + num(); pts.push([x, y]); }
    else if (C === "C") { for (let k = 0; k < 3; k++) { const px = ox + num(), py = oy + num(); pts.push([px, py]); if (k === 2) { x = px; y = py; } } }
    else if (C === "S" || C === "Q") { for (let k = 0; k < 2; k++) { const px = ox + num(), py = oy + num(); pts.push([px, py]); if (k === 1) { x = px; y = py; } } }
    else if (C === "A") { const rx = num(), ry = num(); num(); num(); num(); x = ox + num(); y = oy + num(); pts.push([x - rx, y - ry], [x + rx, y + ry], [x, y]); }
    else i++; // 不明な値は読み飛ばす
  }
  return pts;
}

const round = (n) => Math.round(n * 10) / 10;

function convert(file) {
  const name = path.basename(file, ".svg");
  const defs = { filters: new Map(), patterns: new Map(), images: new Map(), gradients: new Map() };
  const rows = [];
  const stack = [{ m: I, opacity: 1, filter: null, clip: null, blend: null, inDefs: false, fill: null }];
  let cur = null; // defs の中で組み立て中の filter / gradient / pattern

  const onopentag = (node) => {
    const a = node.attributes;
    const top = stack[stack.length - 1];
    const m = mul(top.m, parseTransform(a.transform));
    const style = Object.fromEntries((a.style ?? "").split(";").filter(Boolean).map((kv) => kv.split(":").map((s) => s.trim())));
    const frame = {
      m,
      opacity: top.opacity * (a.opacity != null ? Number(a.opacity) : 1),
      filter: a.filter ?? top.filter,
      clip: a["clip-path"] ?? top.clip,
      blend: style["mix-blend-mode"] ?? top.blend,
      inDefs: top.inDefs || node.name === "defs",
      fill: a.fill ?? top.fill,
    };
    stack.push(frame);

    // ---- defs ----
    if (node.name === "filter") { cur = { kind: "filter", id: a.id, flood: null, dx: 0, dy: 0, blur: 0, spread: 0, color: null, shadow: false }; defs.filters.set(a.id, cur); }
    if (cur?.kind === "filter") {
      if (node.name === "feOffset") { cur.dx = Number(a.dx ?? 0); cur.dy = Number(a.dy ?? 0); cur.shadow = true; }
      if (node.name === "feGaussianBlur" && a.in !== "BackgroundImageFix") cur.blur = Number(a.stdDeviation ?? 0) * 2;
      if (node.name === "feMorphology") cur.spread = (a.operator === "erode" ? -1 : 1) * Number(a.radius ?? 0);
      if (node.name === "feColorMatrix" && a.type !== "alpha" && a.values) {
        const v = a.values.split(/\s+/).map(Number);
        if (v.length === 20) cur.color = `rgba(${Math.round(v[4] * 255)},${Math.round(v[9] * 255)},${Math.round(v[14] * 255)},${round(v[18])})`;
      }
      if (node.name === "feFlood" && a["flood-color"]) cur.flood = `${a["flood-color"]}${a["flood-opacity"] ? `/${a["flood-opacity"]}` : ""}`;
    }
    if (node.name === "linearGradient" || node.name === "radialGradient") { cur = { kind: "gradient", id: a.id, type: node.name, stops: [] }; defs.gradients.set(a.id, cur); }
    if (node.name === "stop" && cur?.kind === "gradient") cur.stops.push(`${a["stop-color"] ?? "#000"}${a["stop-opacity"] ? `/${a["stop-opacity"]}` : ""}@${a.offset ?? 0}`);
    if (node.name === "pattern") { cur = { kind: "pattern", id: a.id, uses: [] }; defs.patterns.set(a.id, cur); }
    if (node.name === "use" && cur?.kind === "pattern") cur.uses.push((a["xlink:href"] ?? a.href ?? "").slice(1));
    if (node.name === "image" && frame.inDefs && a.id) defs.images.set(a.id, `${a.width}x${a.height}`);

    if (frame.inDefs) return;

    // ---- 図形 ----
    let pts = null;
    const n = (k) => Number(a[k] ?? 0);
    if (node.name === "rect") { const x = n("x"), y = n("y"), w = n("width"), h = n("height"); pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]; }
    else if (node.name === "circle") { const cx = n("cx"), cy = n("cy"), r = n("r"); pts = [[cx - r, cy - r], [cx + r, cy + r]]; }
    else if (node.name === "ellipse") { const cx = n("cx"), cy = n("cy"), rx = n("rx"), ry = n("ry"); pts = [[cx - rx, cy - ry], [cx + rx, cy + ry]]; }
    else if (node.name === "line") pts = [[n("x1"), n("y1")], [n("x2"), n("y2")]];
    else if (node.name === "path" && a.d) pts = pathPoints(a.d);
    else if (node.name === "image") { const x = n("x"), y = n("y"), w = n("width"), h = n("height"); pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]; }
    if (!pts || pts.length === 0) return;

    const t = pts.map(([x, y]) => apply(m, x, y));
    const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    const rotate = round((Math.atan2(m[1], m[0]) * 180) / Math.PI);

    let fill = a.fill ?? frame.fill ?? "";
    let kind = "shape";
    const ref = /^url\(#(.+)\)$/.exec(fill);
    if (ref) {
      const g = defs.gradients.get(ref[1]);
      const p = defs.patterns.get(ref[1]);
      if (g) fill = `${g.type === "radialGradient" ? "radial" : "linear"}(${g.stops.join(" ")})`;
      else if (p) { fill = `image(${p.uses.map((u) => defs.images.get(u) ?? u).join(" ")})`; kind = "image"; }
    }
    if (node.name === "image") { fill = `image(${a.width}x${a.height})`; kind = "image"; }
    const sref = /^url\(#(.+)\)$/.exec(a.stroke ?? "");
    const stroke = sref ? `gradient(${defs.gradients.get(sref[1])?.stops.join(" ") ?? sref[1]})` : (a.stroke ?? "");
    if (kind === "shape" && node.name === "path" && h > 0 && h < 80 && w / h > 1.5 && /^#/.test(fill)) kind = "text?";

    const f = frame.filter ? defs.filters.get(frame.filter.replace(/^url\(#|\)$/g, "")) : null;
    const shadow = f?.shadow ? `${f.dx} ${f.dy} ${round(f.blur)} ${f.spread} ${f.color ?? f.flood ?? ""}` : f ? "filter" : "";

    rows.push({
      tag: node.name, x: round(x0), y: round(y0), width: round(w), height: round(h), rotate,
      fill, fill_opacity: a["fill-opacity"] ?? "", stroke, stroke_width: a["stroke-width"] ?? "",
      rx: a.rx ?? "", opacity: round(frame.opacity * 100) / 100, shadow, blend: frame.blend ?? "",
      clip: frame.clip ? "yes" : "", kind,
    });
  };
  const onclosetag = (tag) => {
    stack.pop();
    if (["filter", "linearGradient", "radialGradient", "pattern"].includes(tag)) cur = null;
  };

  // filter / gradient / pattern の定義（defs）は使う側より後ろに書かれるため、2 回読む。
  // 1 回目で defs を集め、2 回目で図形を出す。
  const text = fs.readFileSync(file, "utf8");
  for (let pass = 0; pass < 2; pass++) {
    rows.length = 0;
    stack.length = 1;
    const parser = sax.parser(true, { trim: false });
    parser.onopentag = onopentag;
    parser.onclosetag = onclosetag;
    parser.onerror = (e) => { throw e; };
    parser.write(text).close();
  }

  const cols = ["index", "tag", "x", "y", "width", "height", "rotate", "fill", "fill_opacity", "stroke", "stroke_width", "rx", "opacity", "shadow", "blend", "clip", "kind"];
  const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(","), ...rows.map((r, i) => cols.map((c) => esc(c === "index" ? i + 1 : r[c])).join(","))];
  const out = path.join(outDir, `${name}.csv`);
  fs.writeFileSync(out, "﻿" + lines.join("\n") + "\n"); // Excel で文字化けしないよう BOM を付ける
  const kinds = rows.reduce((acc, r) => ((acc[r.kind] = (acc[r.kind] ?? 0) + 1), acc), {});
  console.log(`${out}: ${rows.length} rows`, kinds);
}

for (const f of inputs) convert(f);
