/**
 * 日本語の文を、改行してよい位置（文節）で区切る。スマホで「ヒアリングか｜ら」のような途中の改行を防ぐ。
 * CSS の word-break: auto-phrase は Safari が対応していないため、サーバーで BudouX を使って区切り、
 * Phrases コンポーネントが区切りに <wbr> を入れる（区切り以外では改行しない）。
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
