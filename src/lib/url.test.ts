import { describe, expect, it } from "vitest";
import { withBase } from "./url";

describe("withBase", () => {
  it("ドメイン直下（base = /）ではそのまま返す", () => {
    expect(withBase("/#about")).toBe("/#about");
    expect(withBase("/")).toBe("/");
  });

  it("外部 URL は変えない", () => {
    expect(withBase("https://example.com/a")).toBe("https://example.com/a");
    expect(withBase("mailto:info@example.com")).toBe("mailto:info@example.com");
  });
});
