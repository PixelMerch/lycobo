import { expect, test } from "@playwright/test";

test("creation is explicit about unavailable generation and keeps navigation accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "开始创作", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("生图服务尚未启用");
  await page.getByLabel("画面描述").fill("泳池边的产品主图");
  await expect(page.getByRole("button", { name: "生成图片" })).toBeDisabled();
  await page.getByRole("link", { name: "任务中心", exact: true }).click();
  await expect(page.getByRole("heading", { name: "任务中心", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "任务中心", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "开始创作", exact: true }).click();
  // Reload resets the session-local draft; the UI never claims server persistence.
  await expect(page.getByLabel("画面描述")).toHaveValue("");
});
test("narrow viewport has no page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "添加参考图" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
