import { describe, expect, it } from "vitest";
import { phrases } from "./phrases";

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
