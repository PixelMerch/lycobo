import { readFileSync } from "node:fs";
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

  it("includes the horizontal hero accordion, logo marquee, sticky deck, and cursor follower", () => {
    expect(heroSection).toContain("lp-hero-accordion");
    expect(heroSection).toContain("lp-logo-marquee");
    expect(capabilitySection).toContain("lp-stack-deck");
    expect(capabilitySection).toContain("lp-float-cursor");
  });
});
