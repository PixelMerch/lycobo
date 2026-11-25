import { describe, expect, it } from "vitest";
import { loginHref, safeLoginReturnTo } from "./login-navigation";

describe("登录后的站内跳转", () => {
  it.each([
    "/",
    "/?category=product#inspiration",
    "/commerce/create?task=fixture#result",
    "/assets",
    "/workspace",
    "/video",
    "/en/commerce/create?task=fixture#result",
    "/zh-CN/assets",
    "/zh-CN/inspiration?category=product",
    "/free-canvas",
    "/zh-CN/free-canvas",
    "/en/dashboard",
    "/zh-CN/dashboard/commerce/create?task=fixture#result",
    "/en/dashboard/free-canvas",
    "/zh-CN/dashboard/assets",
  ])("保留目标 %s", (path) => {
    expect(safeLoginReturnTo(path)).toBe(path);
    expect(new URL(loginHref(path), "https://lycobo.invalid").searchParams.get("returnTo")).toBe(
      path,
    );
  });
  it.each([
    undefined,
    null,
    "",
    "https://example.com/",
    "//example.com/",
    "/\\example.com/",
    "javascript:alert(1)",
    "/login?returnTo=/login",
    "/create",
    "/membership",
    "/zh-CN/membership",
    "/zh-CN/recharge?source=footer#packs",
    "/commerce/../../login",
    "/commerce/../../create",
    "/en/login?returnTo=/en/login",
    "/zh-CN/commerce/../../login",
    "/en/api/v1/image-tasks",
    "/en//example.com",
    "/en/dashboard/login",
    "/en/dashboard/../login",
  ])("拒绝外站、旧路由和登录循环 %s", (path) => {
    expect(safeLoginReturnTo(path)).toBe("/");
  });

  it("登录地址继承目标语言，不把语言前缀当成返回权限", () => {
    expect(loginHref("/zh-CN/assets")).toBe("/zh-CN/login?returnTo=%2Fzh-CN%2Fassets");
    expect(safeLoginReturnTo("/zh-CN/create")).toBe("/");
    expect(safeLoginReturnTo("/fr/assets")).toBe("/");
  });
});
