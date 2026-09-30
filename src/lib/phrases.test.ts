import { describe, expect, it } from "vitest";
import { addPhraseBreaks, phrases } from "./phrases";

const ZW = "​";

describe("phrases", () => {
  it("文節で区切る", () => {
    expect(phrases("ヒアリングから1ヶ月後ごろ")).toEqual(["ヒアリングから", "1ヶ月後ごろ"]);
  });

  it("カタカナの後に漢字が続く位置でも区切る", () => {
    expect(phrases("SNSマーケティング事業")).toEqual(["SNSマーケティング", "事業"]);
  });

  it("「・」の後ろで区切る", () => {
    expect(phrases("SNSコンサルティング・クリエイティブ制作")).toEqual(["SNSコンサルティング・", "クリエイティブ", "制作"]);
  });

  it("金額と単位は分けない", () => {
    expect(phrases("150,000円〜 / 1本")).toEqual(["150,000円〜 / 1本"]);
  });

  it("元の文字は変えない", () => {
    const text = "※企画、制作、投稿、分析レポートを含む。";
    expect(phrases(text).join("")).toBe(text);
  });
});

describe("addPhraseBreaks", () => {
  const page = (body: string) => `<!doctype html><html><head><title>ヒアリングから1ヶ月後ごろ</title></head><body>${body}</body></html>`;

  it("本文の日本語に区切りを入れる", () => {
    expect(addPhraseBreaks(page("<p>ヒアリングから1ヶ月後ごろ</p>"))).toContain(`<p>ヒアリングから${ZW}1ヶ月後ごろ</p>`);
  });

  it("<head>・属性・script・style は変えない", () => {
    const html = page(
      `<img alt="ヒアリングから1ヶ月後ごろ" src="a.webp"><script>const s = "ヒアリングから1ヶ月後ごろ";</script><style>p::after{content:"ヒアリングから"}</style>`,
    );
    expect(addPhraseBreaks(html)).toBe(html);
  });

  it("文字参照を壊さない", () => {
    const out = addPhraseBreaks(page("<p>企画&amp;制作&lt;ヒアリングから&gt;</p>"));
    expect(out.replaceAll(ZW, "")).toContain("<p>企画&amp;制作&lt;ヒアリングから&gt;</p>");
  });

  it("日本語の無い文と、前後の空白はそのまま", () => {
    const body = (text: string) => `<p>\n  Where Tokimeki Originates.\n</p><p>\n  ${text}\n</p>`;
    expect(addPhraseBreaks(page(body("ヒアリングから1ヶ月後ごろ")))).toBe(page(body(`ヒアリングから${ZW}1ヶ月後ごろ`)));
  });
});
