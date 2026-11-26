import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const [locale, width, link, title] of [
  ["en", 1440, "Pricing", "Credit pack pricing"],
  ["zh-CN", 390, "价格", "积分包价格"],
] as const) {
  test(`public pricing shows five packs and works from the ${locale} header`, async ({ page }) => {
    await mockImageApi(page, { signedIn: false });
    await page.route("**/api/v1/credit-pricing", (route) =>
      route.fulfill({ json: apiFixture({ offerEnd: "2026-12-06T16:00:00Z" }) }),
    );
    await page.clock.setFixedTime(new Date("2026-11-26T00:00:00Z"));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/${locale}`);
    if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    await page
      .getByRole("navigation", { name: locale === "en" ? "Main navigation" : "主导航" })
      .getByRole("link", { name: link, exact: true })
      .click();
    await expect(page).toHaveURL(`/${locale}#pricing`);
    const pricing = page.getByRole("region", { name: title, exact: true });
    await expect(pricing.getByRole("heading", { name: title, exact: true })).toBeFocused();
    await expect(pricing.getByRole("listitem")).toHaveCount(5);
    await expect(pricing.locator(".credit-pack-price")).toHaveText([
      "$2.99 USD",
      "$19.99 USD",
      "$39.99 USD",
      "$59.99 USD",
      "$99.99 USD",
    ]);
    if (width === 1440) {
      const pack = pricing.getByRole("listitem").first();
      await pack.hover();
      await expect
        .poll(() =>
          pack
            .locator(".credit-pack-surface")
            .evaluate((element) => getComputedStyle(element, "::after").opacity),
        )
        .toBe("1");
    }
    await expect(
      pricing.getByRole("link", { name: locale === "en" ? "Sign in to top up" : "登录充值" }),
    ).toHaveAttribute("href", new RegExp(`^/${locale}/login\\?returnTo=`));
  });
}

test("public pricing uses regular prices after the shared promotion expires", async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
  await page.route("**/api/v1/credit-pricing", (route) =>
    route.fulfill({ json: apiFixture({ offerEnd: "2026-12-06T16:00:00Z" }) }),
  );
  await page.clock.setFixedTime(new Date("2026-12-07T00:00:00Z"));
  await page.goto("/en#pricing");
  const pricing = page.getByRole("region", { name: "Credit pack pricing" });
  await expect(pricing.locator(".credit-pack-price")).toHaveText([
    "$4.49 USD",
    "$29.99 USD",
    "$59.99 USD",
    "$89.99 USD",
    "$149.99 USD",
  ]);
  await expect(pricing.locator(".credit-pack-bonus")).toHaveCount(0);
});
