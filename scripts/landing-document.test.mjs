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
    "renders the %s bedding photograph and its local creation action",
    (locale) => {
      const copy = landingCopy(locale);
      const document = renderLandingDocument(template, copy, locale);
      const showcase = document.match(/data-landing-showreel[\s\S]*?<\/section>/)?.[0];
      const images = [...(showcase ?? "").matchAll(/src="(data:image\/webp;base64,[^"]+)"/g)];
      expect(new Set(images.map((image) => image[1])).size).toBe(1);
      expect(showcase).toContain(`alt="${copy.heroShowreelQuiltAlt}"`);
      expect(showcase).toContain(`data-showreel-create>${copy.copy119}`);
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
