import { describe, expect, it } from "vitest";
import { readLandingHeader, readLandingNavigation } from "./use-landing-language";

const header = {
  type: "lycobo:header",
  x: 100,
  y: 18,
  width: 86,
  height: 44,
  scrollY: 240,
  theme: "dark",
  menuOpen: false,
  signedIn: false,
};

describe("landing header messages", () => {
  it.each(["dark", "light"])("accepts %s navigation geometry", (theme) => {
    expect(readLandingHeader({ ...header, theme })).toEqual({
      x: 100,
      y: 18,
      width: 86,
      height: 44,
      scrollY: 240,
      theme,
      menuOpen: false,
      signedIn: false,
    });
  });

  it("accepts the wider signed-in layout and mobile menu state", () => {
    expect(
      readLandingHeader({ ...header, width: 368, signedIn: true, menuOpen: true }),
    ).toMatchObject({ width: 368, signedIn: true, menuOpen: true });
  });

  it.each([
    null,
    "en",
    {},
    { ...header, type: "navigate" },
    { ...header, theme: "unknown" },
    { ...header, scrollY: -1 },
    { ...header, x: Number.NaN },
    { ...header, y: Infinity },
    { ...header, width: 0 },
    { ...header, width: 1000 },
    { ...header, height: "44" },
    { ...header, menuOpen: "false" },
    { ...header, signedIn: 1 },
  ])("ignores malformed geometry: %j", (data) => {
    expect(readLandingHeader(data)).toBeNull();
  });
});

describe("landing navigation messages", () => {
  it.each(["/dashboard/free-canvas", "/dashboard/commerce/create", "/dashboard"])(
    "accepts the isolated navigation entry %s",
    (path) => {
      expect(readLandingNavigation({ type: "lycobo:navigate", path })).toBe(path);
    },
  );

  it.each([
    null,
    "free-canvas",
    {},
    { type: "lycobo:header", path: "/dashboard/free-canvas" },
    { type: "lycobo:navigate" },
    { type: "lycobo:navigate", path: "/dashboard/commerce/smart-variation" },
    { type: "lycobo:navigate", path: "https://example.com" },
    { type: "lycobo:navigate", path: "/dashboard/free-canvas?next=https://example.com" },
  ])("ignores other navigation requests: %j", (data) => {
    expect(readLandingNavigation(data)).toBeNull();
  });
});
