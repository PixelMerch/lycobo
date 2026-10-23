import { expect, test } from "@playwright/test";

test("creation link enters the workspace directly and arrow opens the model menu", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "创作", exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole("menu", { name: "浏览模型", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "浏览模型", exact: true }).focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "浏览模型", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveCount(3);
  await menu.getByRole("menuitem", { name: "进入 gpt-image-2 创作", exact: true }).press("Enter");
  await expect(menu).toBeHidden();
  await expect(page.getByLabel("提示词", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
});

test("old entry links recover to current home; unknown model is rejected", async ({ page }) => {
  await page.goto("/design/canvas?task=demo-skin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "为你的商品，创作下一张好图" })).toBeVisible();
  await page.goto("/create/not-a-model");
  await expect(page.getByRole("heading", { name: "页面暂时无法打开" })).toBeVisible();
});

test("legacy image creation URL opens the workspace and preserves task context", async ({
  page,
}) => {
  await page.goto("/chatdraw?task=demo-skin");
  await expect(page).toHaveURL(/\/create\?task=demo-skin$/);
  await expect(page.getByRole("heading", { name: "页面暂时无法打开" })).toHaveCount(0);
  await expect(page.getByLabel("提示词", { exact: true })).toBeVisible();
});
