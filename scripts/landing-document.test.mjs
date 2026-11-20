import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { landingCopy } from "../apps/web/src/features/home/landing/landing-copy.ts";
import { renderLandingDocument } from "../apps/web/src/features/home/landing/render-landing-document.ts";

const template = readFileSync("apps/web/public/openart-reference/index.html", "utf8");

describe("localized landing document", () => {
  it.each(["zh-CN", "en"])(
    "renders the compact %s page with safe navigation and working scripts",
    (locale) => {
      const copy = landingCopy(locale);
      const document = renderLandingDocument(template, copy, locale);
      expect(document).not.toContain("__LYCOBO_");
      expect(document).toContain(`lang="${locale}"`);
      expect(document).not.toMatch(/Trustpilot|support@openart|10M\+|40 free credits/);
      expect(document.match(/<section\b/g)).toHaveLength(3);
      expect(document).toContain(copy.heroLineOne);
      expect(document).toContain(copy.sceneTitle);
      expect(document).toContain(copy.setTitle);
      const links = [...document.matchAll(/<a\b[^>]*data-landing-path="([^"]+)"[^>]*>/g)];
      expect(links.map((link) => link[1])).toEqual([
        "/dashboard",
        "/dashboard/commerce/create",
        "/dashboard/commerce/create",
        "/dashboard/commerce/create",
        "/dashboard/commerce/smart-variation",
        "/dashboard/commerce/smart-variation",
        "/dashboard",
        "/membership",
        "/terms",
        "/privacy",
        "https://bonko.fun/refund-policy",
        "mailto:suport@lycobo.com",
      ]);
      for (const [tag, path] of links) {
        expect(tag).toContain(`href="${path.startsWith("/") ? `/${locale}${path}` : path}"`);
      }
      const photos = [...document.matchAll(/src="(data:image\/webp;base64,[^"]+)"/g)];
      expect(new Set(photos.map((photo) => photo[1])).size).toBe(4);
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
