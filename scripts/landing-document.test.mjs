import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { landingCopy } from "../apps/web/src/features/home/landing/landing-copy.ts";
import { renderLandingDocument } from "../apps/web/src/features/home/landing/render-landing-document.ts";

const template = readFileSync("apps/web/public/openart-reference/index.html", "utf8");

describe("localized landing document", () => {
  it.each(["zh-CN", "en"])(
    "renders complete %s content with executable motion scripts",
    (locale) => {
      const document = renderLandingDocument(template, landingCopy(locale), locale);
      expect(document).not.toContain("__LYCOBO_");
      expect(document).toContain(`lang="${locale}"`);
      expect(document).not.toMatch(/Trustpilot|support@openart|10M\+|40 free credits/);
      expect(document).not.toMatch(/<nav\b[^>]*data-navv3-root/);
      const links = [...document.matchAll(/<a\b[^>]*data-landing-path="([^"]+)"[^>]*>/g)];
      expect(links.map((link) => link[1])).toEqual(["/dashboard"]);
      expect(links[0]?.[0]).toContain(`href="/${locale}/dashboard"`);
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

  it("gives each of the seven distinct hero images exactly one destination", () => {
    const document = renderLandingDocument(template, landingCopy("zh-CN"), "zh-CN");
    const photos = Array.from(
      document.matchAll(
        /data-hero-photo="([a-z]+)"[^>]*>\s*<figure[^>]*>\s*<img src="(data:image\/webp;base64,[^"]+)"/g,
      ),
    );
    const slots = Array.from(document.matchAll(/data-hero-slot="([a-z]+)"/g), (match) => match[1]);
    expect(new Set(photos.map((match) => match[2])).size).toBe(7);
    expect(slots.sort()).toEqual(photos.map((match) => match[1]).sort());
  });

  it.each(["zh-CN", "en"])(
    "renders one %s comparison with three distinct outputs and their captions",
    (locale) => {
      const copy = landingCopy(locale);
      const document = renderLandingDocument(template, copy, locale);
      const showcase = document.match(/data-landing-showreel[\s\S]*?<\/section>/)?.[0];
      const images = [...(showcase ?? "").matchAll(/src="(data:image\/webp;base64,[^"]+)"/g)];
      expect(images).toHaveLength(4);
      expect(new Set(images.map((image) => image[1])).size).toBe(4);
      expect(showcase?.match(/data-showreel-detail/g)).toHaveLength(3);
      for (const name of ["Bedroom", "Sofa", "Texture"]) {
        expect(showcase).toContain(`<figcaption>${copy[`heroShowreel${name}Label`]}</figcaption>`);
      }
      expect(showcase).toContain(`>${copy.heroShowreelSourceLabel}</span>`);
      expect(showcase).toContain(`>${copy.heroShowreelResultLabel}</span>`);
      expect(showcase).toContain('type="range" min="0" max="100" value="37"');
      expect(showcase).toContain(`aria-label="${copy.heroShowreelSliderLabel}"`);
      expect(showcase).not.toContain("<button");
      expect(showcase).not.toContain("<canvas");
      expect(showcase).not.toContain("<video");
      expect(document).toContain("media-src data: blob:;");
    },
  );

  it("rejects missing copy instead of rendering template markers", () => {
    expect(() => renderLandingDocument("__LYCOBO_HTML_unknown__", {}, "en")).toThrow(
      "Missing landing message: unknown",
    );
  });
});
