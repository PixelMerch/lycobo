import { describe, expect, it } from "vitest";
import { readLandingNavigation, readLandingScroll } from "./landing-frame";

describe("landing frame messages", () => {
  it.each([0, 240, 500])("accepts scroll position %s", (scrollY) => {
    expect(readLandingScroll({ type: "lycobo:landing-scroll", scrollY })).toBe(scrollY);
  });

  it.each([-1, Number.NaN, Infinity, "240", undefined])(
    "rejects invalid position %s",
    (scrollY) => {
      expect(readLandingScroll({ type: "lycobo:landing-scroll", scrollY })).toBeNull();
    },
  );

  it.each([
    "/dashboard",
    "/dashboard/commerce/replica",
    "/dashboard/free-canvas",
    "/terms",
    "/privacy",
    "/refund-policy",
  ])("accepts the listed route %s", (path) => {
    expect(readLandingNavigation({ type: "lycobo:navigate", path })).toBe(path);
  });

  it.each([
    null,
    {},
    { type: "lycobo:landing-scroll", path: "/dashboard" },
    { type: "lycobo:navigate" },
    { type: "lycobo:navigate", path: "https://example.com" },
    { type: "lycobo:navigate", path: "https://bonko.fun/refund-policy" },
    { type: "lycobo:navigate", path: "mailto:suport@lycobo.com" },
    { type: "lycobo:navigate", path: "/membership" },
    { type: "lycobo:navigate", path: "https://bonko.fun/refund-policy?next=https://example.com" },
    { type: "lycobo:navigate", path: "/dashboard?next=https://example.com" },
    { type: "lycobo:navigate", path: "/terms?next=https://example.com" },
    { type: "lycobo:navigate", path: "/dashboard/video" },
  ])("rejects other navigation messages: %j", (data) => {
    expect(readLandingNavigation(data)).toBeNull();
  });
});
