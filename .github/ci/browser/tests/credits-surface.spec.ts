import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const width of [1440, 390]) {
  test(`recharge opens without motion when reduced motion is enabled at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/zh-CN/dashboard/commerce/create");
    const draft = page.getByLabel("提示词", { exact: true });
    await draft.fill("打开充值页前的草稿");
    await page.locator(".header-credits").click();
    await page.getByRole("menuitem", { name: "充值积分", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "充值积分", exact: true });
    const surface = dialog.locator(".credit-recharge-surface");
    await expect(surface).toBeVisible();
    await expect(surface).toHaveCSS("background-color", "rgb(11, 11, 11)");
    await expect(surface).toHaveCSS("opacity", "1");
    await expect(surface).toHaveCSS("transform", "none");
    await dialog.getByRole("button", { name: "关闭充值积分", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".account-menu")).toHaveCount(0);
    await expect(page.locator(".header-credits")).toBeFocused();
    await expect(draft).toHaveValue("打开充值页前的草稿");
  });
}
