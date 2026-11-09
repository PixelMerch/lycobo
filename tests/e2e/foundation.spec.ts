import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("workspace entry opens creation with direct tool navigation", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "电商", exact: true }).click();
  await page.getByRole("menuitem", { name: "主图制作", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByRole("button", { name: "全部工具", exact: true })).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "电商创作工具" })
    .getByRole("button", { name: "主图制作", exact: true })
    .click();
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^生成商品主图/ })).toBeDisabled();
});

test("old entry links recover to current home; malformed model is rejected", async ({ page }) => {
  await page.goto("/design/canvas?task=demo-skin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("让每件商品，都有一张好主图");
  await page.goto("/commerce/create/not%20a%20model");
  await expect(page.getByRole("heading", { name: "页面暂时无法打开" })).toBeVisible();
});

test("legacy image creation URL opens the workspace and preserves task context", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/chatdraw?task=demo-skin");
  await expect(page).toHaveURL(/\/commerce\/create\?task=demo-skin$/);
  await expect(page.getByRole("heading", { name: "页面暂时无法打开" })).toHaveCount(0);
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toBeVisible();
});
