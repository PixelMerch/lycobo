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
    const buy = pricing.getByRole("button", {
      name: locale === "en" ? "Top up 102 credits" : "充值 102 积分",
      exact: true,
    });
    await buy.click();
    const login = page.getByRole("dialog", {
      name: locale === "en" ? "Sign in to Lycobo" : "登录 Lycobo",
    });
    await expect(login).toBeVisible();
    await expect(page).toHaveURL(`/${locale}#pricing`);
    await page.keyboard.press("Escape");
    await expect(login).toHaveCount(0);
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

test("public pricing opens the selected checkout in a separate window", async ({
  context,
  page,
}) => {
  await mockImageApi(page);
  const offerEnd = "2026-12-06T16:00:00Z";
  const checkouts: { pack: string; returnTo: string }[] = [];
  let publicOfferReads = 0;
  const checkoutUrl = "https://checkout.creem.io/fixture-pricing";
  await page.route("**/api/v1/credit-pricing", (route) => {
    publicOfferReads++;
    return route.fulfill({ json: apiFixture({ offerEnd }) });
  });
  await page.route("**/api/v1/wallet/checkout", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: apiFixture({ packs: ["offer:catalog"], offerEnd }) });
    const { pack, returnTo } = route.request().postDataJSON();
    checkouts.push({ pack, returnTo });
    return route.fulfill({ json: apiFixture({ url: checkoutUrl }) });
  });
  await context.route(checkoutUrl, (route) => route.fulfill({ body: "Checkout fixture" }));
  await page.clock.setFixedTime(new Date("2026-11-26T00:00:00Z"));
  await page.goto("/en#pricing");
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Top up 1,480 credits", exact: true }).click(),
  ]);
  await expect(popup).toHaveURL(checkoutUrl);
  await expect(page).toHaveURL("/en#pricing");
  expect(publicOfferReads).toBe(0);
  expect(checkouts).toEqual([{ pack: "offer:catalog", returnTo: "/en#pricing" }]);
  await popup.close();
});

test("signing out from a workspace goes straight to the localized homepage", async ({ page }) => {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/logout", (route) => route.fulfill({ json: apiFixture({}) }));
  await page.goto("/zh-CN/dashboard/commerce/create");
  await page.locator(".workspace-site-header .account-trigger").click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL("/zh-CN");
  await expect(page.locator(".login-page")).toHaveCount(0);
  await expect(page.locator(".lp-page")).toBeVisible();
});
