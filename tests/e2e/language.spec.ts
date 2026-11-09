import { expect, type Page, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

// 语言入口必须紧挨在右侧入口（积分胶囊或登录按钮）的左边。
async function expectLeftOf(page: Page, left: string, right: string) {
  const leftBox = await page.locator(left).boundingBox();
  const rightBox = await page.locator(right).boundingBox();
  if (!leftBox || !rightBox) throw new Error("Header entries not found");
  expect(leftBox.x + leftBox.width).toBeLessThanOrEqual(rightBox.x);
  expect(rightBox.x - (leftBox.x + leftBox.width)).toBeLessThanOrEqual(16);
}

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("opens in English and remembers switching to Chinese", async ({ page }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Lycobo · E-commerce Creative Studio");
    const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
    await expect(navigation.locator(".nav-row")).toHaveText(["Home", "E-commerce", "Assets"]);

    const language = page.getByRole("button", { name: "Language: English", exact: true });
    await expect(language).toHaveText("EN");
    await expectLeftOf(page, ".language-trigger", ".header-credits");
    await language.click();
    const menu = page.getByRole("menu", { name: "Language: English" });
    await expect(menu.getByRole("menuitemradio")).toHaveText(["简体中文", "English"]);
    await expect(menu.getByRole("menuitemradio", { name: "English" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await menu.getByRole("menuitemradio", { name: "简体中文" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page).toHaveTitle("Lycobo · 电商创作工作台");
    const chinese = page.getByRole("navigation", { name: "主导航", exact: true });
    await expect(chinese.locator(".nav-row")).toHaveText(["首页", "电商", "素材库"]);

    // 选择记在本机，刷新后不再跟随浏览器语言。
    await page.reload();
    await expect(chinese.locator(".nav-row")).toHaveText(["首页", "电商", "素材库"]);
    await expect(page.getByRole("button", { name: "语言：简体中文", exact: true })).toHaveText(
      "中文",
    );
  });
});

test.describe("Japanese browser", () => {
  test.use({ locale: "ja-JP" });

  test("falls back to English for languages the site does not offer", async ({ page }) => {
    await mockImageApi(page, { signedIn: false });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
    await expect(navigation.locator(".nav-row")).toHaveText(["Home", "E-commerce", "Assets"]);
  });
});

for (const width of [320, 1440]) {
  test(`Chinese browser shows the language entry left of login at ${width}px`, async ({ page }) => {
    await mockImageApi(page, { signedIn: false });
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    const language = page.getByRole("button", { name: "语言：简体中文", exact: true });
    await expect(language).toBeVisible();
    await expectLeftOf(page, ".language-trigger", ".header-login");
    // 手机只留地球图标，顶部栏不能被挤出横向滚动。
    if (width < 768) {
      await expect(language.locator(".language-trigger-name")).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    await language.click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("button", { name: "Language: English", exact: true }),
    ).toBeVisible();
  });
}
