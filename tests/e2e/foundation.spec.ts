import { expect, test } from "@playwright/test";

test("default workspace uses the new design and old links preserve task context", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "批注", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "一张好图，让好商品更动人" })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看新版设计" })).toHaveCount(0);
  await page.getByRole("link", { name: "历史记录", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "历史记录", exact: true })).toBeVisible();
  await page.goto("/design/canvas?task=demo-skin");
  await expect(page).toHaveURL(/\/canvas\?task=demo-skin$/);
});
