import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const landingPage = readFileSync("apps/web/src/features/home/landing/landing-page.tsx", "utf8");
const heroSection = readFileSync(
  "apps/web/src/features/home/landing/landing-hero-section.tsx",
  "utf8",
);
const capabilitySection = readFileSync(
  "apps/web/src/features/home/landing/landing-capability-section.tsx",
  "utf8",
);

describe("Landing composition", () => {
  it("keeps the React sections in order and uses the public footer", () => {
    const sections = Array.from(
      landingPage.matchAll(/<(Landing\w+Section|SiteFooter)\b/g),
      ([, name]) => name,
    );
    expect(sections).toEqual([
      "LandingHeroSection",
      "LandingCapabilitySection",
      "LandingDemoSection",
      "LandingReviewSection",
      "LandingClosingSection",
      "LandingFaqSection",
      "SiteFooter",
    ]);
    expect(landingPage).not.toContain("<iframe");
    expect(landingPage).not.toContain("dangerouslySetInnerHTML");
  });

  it("includes the horizontal hero accordion, sticky deck, and cursor follower", () => {
    expect(heroSection).toContain("lp-hero-accordion");
    expect(capabilitySection).toContain("lp-stack-deck");
    expect(capabilitySection).toContain("lp-float-cursor");
  });

  it("uses the versioned public R2 URL for landing artwork", () => {
    const directory = "apps/web/src/features/home/landing";
    const source = readdirSync(directory)
      .filter((file) => file.endsWith("-section.tsx") || file.endsWith("-assets.ts"))
      .map((file) => readFileSync(`${directory}/${file}`, "utf8"))
      .join("\n");
    expect(source).not.toContain("/landing/ltx/");
    const images = [...source.matchAll(/"\/landing\/[\w/.-]+\.webp"/g)];
    expect(images).not.toHaveLength(0);
    expect([...source.matchAll(/publicImageUrl\("\/landing\/[\w/.-]+\.webp"\)/g)]).toHaveLength(
      images.length,
    );
    expect(readFileSync("apps/web/src/lib/public-image-url.ts", "utf8")).toMatch(
      /https:\/\/static\.lycobo\.com\/site-\d{8}/,
    );
  });
});
