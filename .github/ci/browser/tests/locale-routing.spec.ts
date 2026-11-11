import { expect, type Page, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

async function switchLanguage(page: Page, language: string) {
  await page.locator(".language-trigger").click();
  await page.getByRole("menuitemradio", { name: language, exact: true }).click();
}

test("explicit language wins over storage and switching keeps the home draft and query", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.addInitScript(() => localStorage.setItem("lycobo.locale", "zh-CN"));
  await page.goto("/en?category=product#inspiration");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const prompt = page.locator(".home-composer textarea");
  await prompt.fill("A product photo draft that must survive a language switch");
  await prompt.evaluate((element) => element.setAttribute("data-locale-draft-probe", "kept"));
  await expect(page.locator("html")).toHaveAttribute("data-ws-total", /\d+/);
  const connections = await page.locator("html").getAttribute("data-ws-total");
  await switchLanguage(page, "简体中文");
  await expect(page).toHaveURL(/\/zh-CN\?category=product#inspiration$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(prompt).toHaveValue("A product photo draft that must survive a language switch");
  await expect(prompt).toHaveAttribute("data-locale-draft-probe", "kept");
  await expect(page.locator("html")).toHaveAttribute("data-ws-total", connections ?? "");
  await expect(page.locator(".site-footer-logo")).toHaveAttribute("href", "/zh-CN");
  await page.goBack();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(prompt).toHaveAttribute("data-locale-draft-probe", "kept");
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
