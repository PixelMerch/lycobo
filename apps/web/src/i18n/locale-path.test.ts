import { describe, expect, it } from "vitest";
import { localeFromPath, localizedPath, withoutLocale } from "./locale-path";

describe("页面语言前缀", () => {
  it.each([
    ["/zh-CN/commerce/create?task=fixture#result", "/commerce/create?task=fixture#result"],
    ["/en", "/"],
    ["/en?category=product#inspiration", "/?category=product#inspiration"],
    ["/en/", "/"],
    ["/commerce/create", "/commerce/create"],
  ])("提取业务地址 %s", (input, expected) => {
    expect(withoutLocale(input)).toBe(expected);
  });

  it("显式语言只接受完整的首段", () => {
    expect(localeFromPath("/zh-CN/assets")).toBe("zh-CN");
    expect(localeFromPath("/en?task=fixture")).toBe("en");
    expect(localeFromPath("/english/assets")).toBeNull();
    expect(localeFromPath("/fr/assets")).toBeNull();
  });

  it.each([
    ["/en/commerce/create?task=fixture#result", "/zh-CN/commerce/create?task=fixture#result"],
    ["/", "/zh-CN"],
    ["/?category=product#inspiration", "/zh-CN?category=product#inspiration"],
    ["/login?returnTo=%2Fen%2Fassets", "/zh-CN/login?returnTo=%2Fen%2Fassets"],
  ])("换语言不丢失页面参数 %s", (input, expected) => {
    expect(localizedPath(input, "zh-CN")).toBe(expected);
  });

  it.each([
    "/api/v1/image-tasks",
    "/images/id",
    "/brand/logo.svg",
    "https://example.com",
    "//example.com",
    "?task=id",
    "#result",
  ])("不改动接口、资源及非页面绝对地址 %s", (path) => {
    expect(localizedPath(path, "en")).toBe(path);
  });
});
