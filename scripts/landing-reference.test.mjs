import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reference = readFileSync("apps/web/public/openart-reference/index.html", "utf8");
const features = readFileSync("apps/web/src/features/home/landing/landing-features.html", "utf8");
const showcase = readFileSync("apps/web/src/features/home/landing/landing-showcase.html", "utf8");
const container = readFileSync("apps/web/src/features/home/landing/landing-page.tsx", "utf8");

describe("Landing document isolation", () => {
  it("keeps the compact product showcase without remote scripts or media", () => {
    expect(reference).toContain("__LYCOBO_HERO__");
    expect(reference).toContain("__LYCOBO_MOTION_SCRIPT__");
    expect(reference).toContain("__LYCOBO_SHOWCASE__");
    expect(showcase).toContain('class="landing-case-grid"');
    expect(reference).toContain("__LYCOBO_FAQ__");
    expect(reference).not.toMatch(/<script\b[^>]*\bsrc=/i);
    expect(reference + showcase + features).not.toMatch(
      /<(img|video|source)\b[^>]*\bsrc="(?!data:|__LYCOBO_IMAGE_(?:scene|set|lamp|collection|textile|optimize)__")/i,
    );
    expect(reference).not.toMatch(/<link\b/i);
    expect(reference).not.toMatch(/<iframe\b/i);
  });

  it("blocks network, forms and access to the host application", () => {
    expect(reference).toContain("connect-src 'none'");
    expect(reference).toContain("form-action 'none'");
    expect(reference).toContain("default-src 'none'");
    expect(container).toContain('sandbox="allow-scripts"');
    expect(container).not.toContain("allow-same-origin");
    expect(container).not.toContain("allow-popups");
  });

  it("excludes recorded trackers and outgoing navigation", () => {
    expect(reference).not.toMatch(/google_tags_first_party|gtm\.start|sendBeacon|document\.cookie/);
    expect(reference).not.toMatch(/window\.open\(|window\.location\.href\s*=/);
    expect(reference).toContain('name="robots" content="noindex,nofollow"');
  });
});
