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
    "/membership",
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
    "/commerce/../../login",
    "/commerce/../../create",
  ])("拒绝外站、旧路由和登录循环 %s", (path) => {
    expect(safeLoginReturnTo(path)).toBe("/");
  });
});
