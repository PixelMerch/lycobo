import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { landingCopy } from "../apps/web/src/features/home/landing/landing-copy.ts";
import { readLandingNavigation } from "../apps/web/src/features/home/landing/landing-frame.ts";
import { renderLandingDocument } from "../apps/web/src/features/home/landing/render-landing-document.ts";

const template = readFileSync("apps/web/public/openart-reference/index.html", "utf8");

describe("localized landing document", () => {
  it.each(["zh-CN", "en"])(
    "renders the %s product showcase with safe navigation and working scripts",
    (locale) => {
      const copy = landingCopy(locale);
      const document = renderLandingDocument(template, copy, locale);
      expect(document).not.toContain("__LYCOBO_");
      expect(document).toContain(`lang="${locale}"`);
      expect(document).not.toMatch(/Trustpilot|support@openart|10M\+|40 free credits|AI-generated/);
      expect(document.match(/<section\b/g)).toHaveLength(10);
      expect(document).toContain(copy.heroLineOne);
      expect(document).toContain(copy.sceneTitle);
      expect(document).toContain(copy.comparisonControl);
      expect(document).toContain(copy.plannerPromptHeading);
      expect(document).toContain(copy.plannerBriefExample);
      expect(document).toContain(copy.plannerPromptDetail);
      expect(document.match(/name="landing-plan-phase"/g)).toHaveLength(3);
      expect(document.match(/name="landing-plan-shot"/g)).toHaveLength(3);
      const features = [
        ...document.matchAll(/<ol class="landing-feature-steps">([\s\S]*?)<\/ol>/g),
      ];
      expect(
        features.flatMap(([, list]) =>
          [...list.matchAll(/<h3>(.*?)<\/h3>/g)].map((step) => step[1]),
        ),
      ).toEqual([copy.textileStepOneTitle, copy.textileStepTwoTitle, copy.textileStepThreeTitle]);
      expect(document).toContain(copy.textileDescription);
      expect(document).toContain(copy.promptAfter);
      expect(document).toContain(copy.review1Quote);
      expect(document).toContain(copy.review8Name);
      expect(document.match(/class="landing-review-card"/g)).toHaveLength(8);
      expect(document).toContain(copy.pricingTitle);
      expect(document).toContain(copy.pricingUnavailable);
      expect(document.match(/class="landing-pricing-card"/g)).toHaveLength(4);
      expect(document).not.toContain('name="credit-pack"');
      expect(document.match(/class="landing-action landing-pricing-buy" disabled/g)).toHaveLength(
        4,
      );
      for (const price of ["$9.90", "$29.90", "$59.90", "$99.90"])
        expect(document).toContain(price);
      expect(document).toContain(copy.faqCreditsAnswer);
      expect(document).toContain(copy.faqFailureAnswer);
      expect(document).not.toContain("Next up:");
      expect(document.match(/<details\b/g)).toHaveLength(6);
      expect(document).not.toMatch(/<details\b[^>]*\bopen(?:\s|=|>)/);
      const links = [...document.matchAll(/<a\b[^>]*data-landing-path="([^"]+)"[^>]*>/g)];
      expect(links.map((link) => link[1])).toEqual([
        "/dashboard",
        "/dashboard/commerce/create",
        "/dashboard/commerce/create",
        "/dashboard/commerce/smart-variation",
        "/dashboard/commerce/textile-set",
        "/dashboard/commerce/create",
        "/dashboard",
        "/dashboard/commerce/create",
        "/dashboard/commerce/smart-variation",
        "/dashboard/commerce/textile-set",
        "/dashboard/commerce/replica",
        "/dashboard",
        "/dashboard/free-canvas",
        "/dashboard/assets",
        "/inspiration",
        "/terms",
        "/privacy",
        "/refund-policy",
      ]);
      for (const [tag, path] of links) {
        expect(tag).toContain(`href="${path.startsWith("/") ? `/${locale}${path}` : path}"`);
        expect(readLandingNavigation({ type: "lycobo:navigate", path })).toBe(path);
      }
      const photos = [...document.matchAll(/src="(data:image\/webp;base64,[^"]+)"/g)];
      expect(new Set(photos.map((photo) => photo[1])).size).toBe(8);
      for (const match of document.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
        expect(() => new Script(match[1])).not.toThrow();
      }
    },
  );

  it("escapes markup and script strings independently", () => {
    const message = `</script><img src=x onerror=alert(1)>"'\n\u2028`;
    const document = renderLandingDocument(
      '<p title="__LYCOBO_HTML_text__">__LYCOBO_HTML_text__</p><script>var text="__LYCOBO_JS_text__";</script>',
      { text: message },
      "en",
    );
    expect(document).not.toContain("<img");
    expect(document.match(/<\/script>/g)).toHaveLength(1);
    expect(document).toContain("&quot;&#39;");
    const script = document.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeDefined();
    expect(new Script(`${script}\ntext;`).runInNewContext()).toBe(message);
  });

  it("rejects missing copy instead of rendering template markers", () => {
    expect(() => renderLandingDocument("__LYCOBO_HTML_unknown__", {}, "en")).toThrow(
      "Missing landing message: unknown",
    );
  });
});
