import { afterEach, describe, expect, it, vi } from "vitest";
import { commerceToolHref, commerceTools } from "../features/commerce/commerce-tools";
import { redirectCommerceToHome } from "./locale-route";

afterEach(() => vi.unstubAllGlobals());

describe("legacy commerce landing redirect", () => {
  it.each(["zh-CN", "en"])("keeps %s, query parameters and the browser fragment", (locale) => {
    const pathname = `/${locale}/commerce`;
    vi.stubGlobal("window", {
      location: { pathname, search: "?tool=create", hash: "#commerce-composer" },
    });
    const response = redirectCommerceToHome(new Request(`http://localhost${pathname}?tool=create`));
    expect(response.headers.get("Location")).toBe(`/${locale}?tool=create#commerce-composer`);
  });

  it("does not copy a fragment from a different page", () => {
    vi.stubGlobal("window", {
      location: { pathname: "/en/inspiration", search: "", hash: "#other" },
    });
    const response = redirectCommerceToHome(new Request("http://localhost/en/commerce"));
    expect(response.headers.get("Location")).toBe("/en");
  });

  it("preserves an explicit fragment from the requested URL", () => {
    const response = redirectCommerceToHome(
      new Request("http://localhost/zh-CN/commerce?tool=textile#details"),
    );
    expect(response.headers.get("Location")).toBe("/zh-CN?tool=textile#details");
  });

  it("points public tool links to the homepage while preserving workspace routes", () => {
    expect(commerceToolHref("create")).toBe("/?tool=create#commerce-composer");
    expect(commerceTools.map((tool) => tool.href)).toEqual([
      "/commerce/create",
      "/commerce/textile-set",
      "/commerce/smart-variation",
      "/commerce/replica",
    ]);
  });
});
