import { expect, test } from "@playwright/test";

test("home to two-model chooser to workspace, with correctly anchored panel and focus recovery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1584, height: 993 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "创作首页" })).toBeVisible();
  const trigger = page.getByRole("button", { name: "图片创作", exact: true });
  await trigger.click();
  const chooser = page.getByRole("dialog", { name: "图片创作", exact: true });
  await expect(chooser).toBeVisible();
  await expect(chooser.locator(".model-card")).toHaveCount(2);
  const box = await chooser.boundingBox();
  const sidebar = await page.locator(".sidebar").boundingBox();
  expect(box && sidebar && Math.abs(box.x - sidebar.width - 24)).toBeLessThan(1);
  expect(
    await page
      .locator(".chooser-backdrop")
      .evaluate((node) => getComputedStyle(node, "::before").backgroundColor),
  ).toBe("rgb(15, 15, 18)");
  await chooser.press("Escape");
  await expect(chooser).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const modelCard = chooser.getByRole("button", { name: "进入 GPT Image 创作" });
  await modelCard.focus();
  await modelCard.press("Enter");
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByLabel("提示词", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("region", { name: "创作参数", exact: true }).getByText("模型", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("生成服务尚未开放")).toHaveCount(0);
  await expect(page.getByText("费用 —", { exact: true })).toHaveCount(0);
});

test("old entry links recover to current home; unknown model is rejected", async ({ page }) => {
  await page.goto("/design/canvas?task=demo-skin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "创作首页" })).toBeVisible();
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
