import { describe, expect, it } from "vitest";
import { readLandingHeader } from "./use-landing-language";

const header = {
  type: "lycobo:header",
  x: 100,
  y: 18,
  width: 86,
  height: 44,
  scrollY: 240,
  theme: "dark",
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
    });
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
  ])("ignores malformed geometry: %j", (data) => {
    expect(readLandingHeader(data)).toBeNull();
  });
});
