import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("legal contents support keyboard anchors and keep the chapter when switching language", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/terms");
  const contents = page.getByRole("navigation", { name: "On this page", exact: true });
  const chapter = contents.locator('a[href="#terms-section-5"]');
  await chapter.focus();
  await chapter.press("Enter");
  await expect(page).toHaveURL(/\/en\/terms#terms-section-5$/);
  await expect(page.locator("#terms-section-5")).toBeInViewport();
  await expect(chapter).toHaveAttribute("aria-current", "location");
  await page.locator(".language-trigger").click();
  await page.getByRole("menuitemradio", { name: "简体中文", exact: true }).click();
  await expect(page).toHaveURL(/\/zh-CN\/terms#terms-section-5$/);
  await expect(page.locator("#terms-section-5")).toBeInViewport();
});

test("shared chapter links survive reload and switching documents starts at the top", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/zh-CN/privacy#privacy-section-3");
  const chapter = page.locator("#privacy-section-3");
  await expect(chapter).toBeInViewport();
  await page.reload();
  await expect(chapter).toBeInViewport();
  await page.locator(".legal-switch").getByRole("link", { name: "用户协议", exact: true }).click();
  await expect(page).toHaveURL(/\/zh-CN\/terms$/);
  await expect(page.locator("#legal-title")).toBeInViewport();
});

test("mobile contents appear above the document and retain touch-sized chapter links", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh-CN/terms");
  const contents = page.getByRole("navigation", { name: "本页目录", exact: true });
  await expect(contents).toBeVisible();
  const links = contents.getByRole("link");
  const heights = await links.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().height),
  );
  expect(heights.every((height) => height >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await contents.locator('a[href="#terms-section-2"]').click();
  await expect(page.locator("#terms-section-2")).toBeInViewport();
});
