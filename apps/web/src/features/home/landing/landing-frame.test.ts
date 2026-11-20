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

  it.each(["/dashboard", "/terms", "/privacy"])("accepts the public route %s", (path) => {
    expect(readLandingNavigation({ type: "lycobo:navigate", path })).toBe(path);
  });

  it.each([
    null,
    {},
    { type: "lycobo:landing-scroll", path: "/dashboard" },
    { type: "lycobo:navigate" },
    { type: "lycobo:navigate", path: "https://example.com" },
    { type: "lycobo:navigate", path: "/dashboard?next=https://example.com" },
    { type: "lycobo:navigate", path: "/terms?next=https://example.com" },
    { type: "lycobo:navigate", path: "/dashboard/free-canvas" },
  ])("rejects other navigation messages: %j", (data) => {
    expect(readLandingNavigation(data)).toBeNull();
  });
});
