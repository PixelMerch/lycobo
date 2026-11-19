import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const path of ["/commerce/create", "/commerce/textile-set", "/commerce/smart-variation"]) {
  test(`composer banner collapses without changing scroll geometry on ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await mockImageApi(page);
    await page.goto(path);
    const scroll = page.locator(".composer-scroll");
    const hero = page.locator(".workspace-composer-hero");
    const isMain = path === "/commerce/create";
    const decoration = hero.locator(isMain ? "img" : "p");
    await expect(hero).toHaveAttribute("data-collapsed", "false");
    const measure = () =>
      scroll.evaluate((element) => {
        const hero = element.querySelector(".workspace-composer-hero");
        const content = hero?.nextElementSibling;
        if (!hero || !content) throw new Error("Missing banner content");
        return {
          top: element.scrollTop,
          height: element.scrollHeight,
          contentTop: content.getBoundingClientRect().top,
          visibleHero: hero.getBoundingClientRect().bottom - element.getBoundingClientRect().top,
        };
      });
    const initial = await measure();
    expect(initial.visibleHero).toBeCloseTo(148, 0);
    await scroll.evaluate((element) => element.scrollTo({ top: 120, behavior: "instant" }));
    await expect(hero).toHaveAttribute("data-collapsed", "true");
    await page.screenshot({ path: test.info().outputPath("collapsed.png") });
    const collapsed = await measure();
    expect(collapsed.height).toBe(initial.height);
    expect(collapsed.top).toBe(120);
    expect(collapsed.contentTop).toBeCloseTo(initial.contentTop - 120, 0);
    expect(collapsed.visibleHero).toBeCloseTo(48, 0);
    await expect(decoration).toHaveCSS("opacity", "0");
    await expect(hero.locator("h2")).toBeInViewport();
    // Crossing the collapse boundary in either direction must not alter scroll offset or content height.
    for (const top of [98, 101, 99, 105, 0]) {
      await scroll.evaluate((element, top) => element.scrollTo({ top, behavior: "instant" }), top);
      await expect.poll(async () => (await measure()).top).toBe(top);
      expect((await measure()).height).toBe(initial.height);
    }
    await expect(hero).toHaveAttribute("data-collapsed", "false");
    await expect(decoration).toHaveCSS("opacity", "1");
    expect((await measure()).visibleHero).toBeCloseTo(148, 0);
    await page
      .locator(".results-panel")
      .evaluate((element) => element.scrollTo({ top: 200, behavior: "instant" }));
    await expect(hero).toHaveAttribute("data-collapsed", "false");
  });
}

for (const path of ["/commerce/create", "/commerce/textile-set", "/commerce/smart-variation"]) {
  test(`mobile composer banner restores at the top on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockImageApi(page);
    await page.goto(path);
    if (path !== "/commerce/textile-set") {
      const prompt = page.locator(".prompt-field").getByRole("textbox");
      await prompt.fill("商品细节描述".repeat(120));
      await prompt.evaluate((element) => element.blur());
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }
    const hero = page.locator(".workspace-composer-hero");
    const isMain = path === "/commerce/create";
    const decoration = hero.locator(isMain ? "img" : "p");
    const scroller = page.locator(".composer-scroll");
    await expect(hero).toHaveAttribute("data-collapsed", "false");
    const start = await scroller.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), start + 100 - 60);
    await expect(hero).toHaveAttribute("data-collapsed", "true");
    expect(await hero.evaluate((element) => element.getBoundingClientRect().bottom)).toBeCloseTo(
      108,
      0,
    );
    await expect(decoration).toHaveCSS("opacity", "0");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(hero).toHaveAttribute("data-collapsed", "false");
    await expect(decoration).toHaveCSS("opacity", "1");
  });
}
