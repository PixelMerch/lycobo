import { expect, type Page, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

async function switchLanguage(page: Page, language: string) {
  await page.locator(".language-trigger").click();
  await page.getByRole("menuitemradio", { name: language, exact: true }).click();
}

test("the homepage language menu stays anchored while scrolling under the pointer", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/en");
  const trigger = page.locator(".language-trigger");
  const option = page.getByRole("menuitemradio", { name: "English", exact: true });
  await trigger.hover();
  await option.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(option).toBeInViewport();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.mouse.move(320, 260);
  await expect(option).toBeHidden();
});

test("homepage language follows the URL and switching preserves query, history, and scroll", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.addInitScript(() => localStorage.setItem("lycobo.locale", "zh-CN"));
  await page.goto("/en?tool=create#commerce-composer");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const title = page.locator("#lp-hero-title");
  await expect(title).toContainText("Product photos");
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
  await switchLanguage(page, "简体中文");
  await expect(page).toHaveURL(/\/zh-CN\?tool=create#commerce-composer$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(title).toContainText("让你的商品图");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
  await page.goBack();
  await expect(page).toHaveURL(/\/en\?tool=create#commerce-composer$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(title).toContainText("Product photos");
});

test("workspace language switch preserves draft and routes tool navigation in the selected language", async ({
  page,
}) => {
  await mockImageApi(page);
  const localizedApiRequests: string[] = [];
  page.on("request", (request) => {
    if (/^\/(?:en|zh-CN)\/api\//.test(new URL(request.url()).pathname))
      localizedApiRequests.push(request.url());
  });
  await page.goto("/zh-CN/commerce/create?view=fixture#draft");
  const prompt = page.getByRole("textbox", { name: "提示词", exact: true });
  await prompt.fill("保留这个商品图草稿");
  await prompt.evaluate((element) => element.setAttribute("data-locale-draft-probe", "kept"));
  await switchLanguage(page, "English");
  await expect(page).toHaveURL(/\/en\/dashboard\/commerce\/create\?view=fixture#draft$/);
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(
    "保留这个商品图草稿",
  );
  await expect(page.locator('[data-locale-draft-probe="kept"]')).toBeVisible();
  await expect(page.locator(".workspace-site-header .header-workspace")).toHaveAttribute(
    "href",
    "/en/dashboard",
  );
  expect(localizedApiRequests).toEqual([]);
});

test("unprefixed protected links preserve their query through localized login", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/commerce/create?task=fixture#result");
  await expect(page).toHaveURL(/\/zh-CN\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/zh-CN/dashboard/commerce/create?task=fixture#result",
  );
  await expect(page.getByRole("heading", { name: "登录 Lycobo", exact: true })).toBeVisible();
  await expect(page.locator(".login-agreement a").first()).toHaveAttribute("href", "/zh-CN/terms");
  await page.goto("/en/login?returnTo=%2Fzh-CN%2Fassets");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Close sign-in", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
});
