/**
 * 日本語の文を、改行してよい位置（文節）で区切る（Google の BudouX）。
 * スマホで「ヒアリングか｜ら」のような途中の改行を防ぐ。
 *
 * サイト全体の HTML に middleware で適用する（addPhraseBreaks）。CSS の word-break: auto-phrase は
 * Safari が対応していないため、サーバーで区切りを入れ、global.css の word-break: keep-all で区切り以外では改行させない。
 */
import { loadDefaultJapaneseParser } from "budoux";

const parser = loadDefaultJapaneseParser();

/*
 * BudouX は「SNSマーケティング事業」のような複合語を 1 つにまとめる。見出しは長い複合語が多いので、
 * カタカナ・英字の後に漢字が続く位置（マーケティング｜事業）と、「・」の後ろでも区切る。
 * 数字や「ヶ」の後（150,000円・1ヶ月）では区切らないよう、カタカナ・英字が 2 文字以上続いたときだけにする。
 */
const EXTRA_BREAK = /(?<=[ァ-ヴー]{2}|[A-Za-z]{2})(?=\p{Script=Han})|(?<=・)/u;

export function phrases(text: string): string[] {
  return parser.parse(text).flatMap((chunk) => chunk.split(EXTRA_BREAK)).filter((s) => s !== "");
}

/*
 * 区切りにはゼロ幅スペース（U+200B）を入れる。<wbr> は white-space: nowrap の中でも改行されてしまう（Chrome）ため、
 * 1 行に収めたい要素（ボタン・表の見出しなど）を崩さないよう、nowrap が効くゼロ幅スペースにする。
 */
const BREAK = "​";
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

// 中身を触らない要素（コード・スタイル・<title> など）。タグ・コメントもそのまま残す
const TOKEN =
  /<!--[\s\S]*?-->|<(script|style|textarea|pre|code|title|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]*>|[^<]+/giu;

const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|#39|apos|nbsp));/giu;
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const decode = (s: string) =>
  s.replace(ENTITY, (m, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return name ? (NAMED[name.toLowerCase()] ?? m) : m;
  });
const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML の本文の日本語に、文節の区切り（ゼロ幅スペース）を入れる。タグ・属性・除外した要素の中は変えない */
export function addPhraseBreaks(html: string): string {
  const body = html.search(/<body[\s>]/i);
  if (body < 0) return html;
  const head = html.slice(0, body);
  const rest = html.slice(body).replace(TOKEN, (token) => {
    if (token.startsWith("<") || !JAPANESE.test(token)) return token;
    const text = decode(token);
    // 前後の空白（改行・インデント）はそのまま残し、中身だけを区切る
    const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/u)!;
    return encode(lead + phrases(core!).join(BREAK) + trail);
  });
  return head + rest;
}
