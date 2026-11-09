import { describe, expect, it } from "vitest";
import { detectLocale, parseLocale } from "./locale";

describe("detectLocale", () => {
  it("uses Simplified Chinese for any Chinese browser language", () => {
    expect(detectLocale(["zh-CN"])).toBe("zh-CN");
    expect(detectLocale(["zh"])).toBe("zh-CN");
    expect(detectLocale(["zh-TW", "en-US"])).toBe("zh-CN");
    expect(detectLocale(["ZH-hans-CN"])).toBe("zh-CN");
  });

  it("uses English for English and for languages the site does not offer", () => {
    expect(detectLocale(["en-US", "zh-CN"])).toBe("en");
    expect(detectLocale(["ja-JP"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });

  it("takes the first supported language in the preference order", () => {
    expect(detectLocale(["fr-FR", "zh-CN", "en"])).toBe("zh-CN");
    expect(detectLocale(["de", "en-GB", "zh"])).toBe("en");
  });

  it("does not mistake other languages whose codes start with the same letters", () => {
    expect(detectLocale(["zha"])).toBe("en");
    expect(detectLocale(["enm", "zh"])).toBe("zh-CN");
  });
});

describe("parseLocale", () => {
  it("accepts only supported locale codes", () => {
    expect(parseLocale("zh-CN")).toBe("zh-CN");
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("en-US")).toBeNull();
    expect(parseLocale(null)).toBeNull();
    expect(parseLocale(1)).toBeNull();
  });
});
