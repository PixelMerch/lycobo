import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const width of [1440, 1920]) {
  test(`chooser leaves the header and history rail uncovered at ${width}px`, async ({ page }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/create");
    for (const collapsed of [false, true]) {
      if (collapsed) await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
      const trigger = page.getByRole("button", { name: "创作", exact: true });
      await trigger.click();
      const chooser = page.getByRole("dialog", { name: "创作", exact: true });
      await expect(chooser).toBeVisible();
      // Allow the existing sidebar width transition to reach its new geometry.
      await expect
        .poll(async () => {
          const box = await page.locator(".sidebar").boundingBox();
          return Math.round(box?.width ?? 0);
        })
        .toBe(collapsed ? 64 : width >= 1800 ? 288 : 274);
      const geometry = await page.evaluate(() => {
        const box = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
        };
        return {
          overlay: box(".chooser-backdrop"),
          panel: box(".model-chooser"),
          header: box(".topbar"),
          sidebar: box(".sidebar"),
          rail: box(".history-rail"),
          blur: getComputedStyle(document.querySelector(".chooser-backdrop")!).backdropFilter,
        };
      });
      expect(geometry.overlay.y).toBeGreaterThanOrEqual(geometry.header.bottom);
      expect(geometry.overlay.x).toBeCloseTo(geometry.sidebar.right, 0);
      expect(geometry.overlay.right).toBeCloseTo(geometry.rail.x, 0);
      expect(geometry.panel.x).toBeGreaterThan(geometry.overlay.x);
      expect(geometry.panel.right).toBeLessThan(geometry.rail.x);
      expect(geometry.panel.y).toBeCloseTo(geometry.header.bottom + 12, 0);
      expect(geometry.panel.bottom).toBeLessThanOrEqual(geometry.overlay.bottom);
      expect(geometry.blur).toBe("none");
      await chooser.press("Escape");
      await expect(chooser).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  });
}

for (const width of [1024, 390]) {
  test(`chooser stays below the header without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    const navigation = width < 768 ? page.locator(".mobile-nav") : page.locator(".sidebar");
    await navigation.getByRole("button", { name: "创作", exact: true }).click();
    const chooser = page.getByRole("dialog", { name: "创作", exact: true });
    await expect(chooser).toBeVisible();
    const header = await page.locator(".topbar").boundingBox();
    const overlay = await page.locator(".chooser-backdrop").boundingBox();
    const panel = await chooser.boundingBox();
    if (!header || !overlay || !panel) throw new Error("Missing chooser geometry");
    expect(overlay.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await chooser.press("Escape");
    await expect(chooser).toHaveCount(0);
  });
}

test("covers rotate without layout movement and pause while browsing a model", async ({ page }) => {
  await mockImageApi(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "创作", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "创作", exact: true });
  const card = chooser.getByRole("button", { name: "进入 gpt-image-2 创作" });
  const activeCover = card.locator("img.is-visible");
  await expect(activeCover).toHaveAttribute("src", /image-2-1.webp$/);
  await page.clock.runFor(4300);
  await expect(activeCover).toHaveAttribute("src", /image-2-2.webp$/);
  await card.hover();
  await page.clock.runFor(6000);
  await expect(activeCover).toHaveAttribute("src", /image-2-2.webp$/);
  await card.focus();
  await page.mouse.move(0, 0);
  await page.clock.runFor(6000);
  await expect(activeCover).toHaveAttribute("src", /image-2-2.webp$/);
  await chooser.press("Escape");
  await expect(chooser).toHaveCount(0);
  await page.getByRole("button", { name: "创作", exact: true }).click();
  await expect(activeCover).toHaveAttribute("src", /image-2-1.webp$/);
});
