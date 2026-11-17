import { expect, type Page, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

async function switchLanguage(page: Page, language: string) {
  await page.locator(".language-trigger").click();
  await page.getByRole("menuitemradio", { name: language, exact: true }).click();
}

test("homepage language follows the URL and switching preserves query and history", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.addInitScript(() => localStorage.setItem("lycobo.locale", "zh-CN"));
  await page.goto("/en?tool=create#commerce-composer");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const landing = page.frameLocator("iframe.openart-reference");
  await expect(landing.locator("html")).toHaveAttribute("lang", "en");
  await page.locator(".landing-language-control .language-trigger").click();
  await page.getByRole("menuitemradio", { name: "简体中文", exact: true }).click();
  await expect(page).toHaveURL(/\/zh-CN\?tool=create#commerce-composer$/);
  await expect(landing.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.goBack();
  await expect(page).toHaveURL(/\/en\?tool=create#commerce-composer$/);
  await expect(landing.locator("html")).toHaveAttribute("lang", "en");
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
  await expect(page).toHaveURL(/\/en\/commerce\/create\?view=fixture#draft$/);
  await expect(page.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(
    "保留这个商品图草稿",
  );
  await expect(page.locator('[data-locale-draft-probe="kept"]')).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("link", { name: "Assets", exact: true })
    .click();
  await expect(page).toHaveURL(/\/en\/assets$/);
  expect(localizedApiRequests).toEqual([]);
});

test("unprefixed protected links preserve their query through localized login", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/commerce/create?task=fixture#result");
  await expect(page).toHaveURL(/\/zh-CN\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/zh-CN/commerce/create?task=fixture#result",
  );
  await expect(page.getByRole("heading", { name: "登录 Lycobo", exact: true })).toBeVisible();
  await expect(page.locator(".login-agreement a").first()).toHaveAttribute("href", "/zh-CN/terms");
  await page.goto("/en/login?returnTo=%2Fzh-CN%2Fassets");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Close sign-in", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
});
