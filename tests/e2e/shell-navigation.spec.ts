import { expect, test } from "@playwright/test";

test("collapsed navigation preserves drafts, chooser anchoring and keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1584, height: 993 });
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留这份商品创作草稿");
  await expect(page.locator(".sidebar nav .nav-row")).toHaveText([
    "首页",
    "创作",
    "AI 电商",
    "素材库",
  ]);
  await expect(page.getByRole("button", { name: "TK 专区", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
  const expand = page.getByRole("button", { name: "展开导航栏", exact: true });
  await expect(expand).toHaveAttribute("aria-expanded", "false");

  const images = page.getByRole("button", { name: "创作", exact: true });
  await images.click();
  const chooser = page.getByRole("dialog", { name: "创作", exact: true });
  await expect(chooser).toBeVisible();
  const panel = await chooser.boundingBox();
  const sidebar = await page.locator(".sidebar").boundingBox();
  expect(panel && sidebar && Math.abs(panel.x - sidebar.width - 12)).toBeLessThan(1);
  await chooser.press("Escape");
  await expect(chooser).toBeHidden();
  await expect(images).toBeFocused();
  await expand.focus();
  await expand.press("Enter");
  await expect(page.getByRole("button", { name: "收起导航栏", exact: true })).toBeVisible();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  const mobileNav = page.locator(".mobile-nav");
  await expect(mobileNav.locator("nav .nav-row")).toHaveText(["首页", "创作", "AI 电商", "素材库"]);
  await expect(mobileNav.getByRole("button", { name: "TK 专区", exact: true })).toHaveCount(0);
  await mobileNav.getByRole("button", { name: "关闭导航", exact: true }).click();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
});
