import { expect, type Locator, test } from "@playwright/test";

async function expectAlignedNavigation(rows: Locator) {
  const positions = await rows.evaluateAll((nodes) =>
    nodes.map((node) => ({
      icon: node.querySelector(".ui-icon")?.getBoundingClientRect().x,
      text: node.querySelector(".nav-label")?.getBoundingClientRect().x,
    })),
  );
  expect(positions).toHaveLength(4);
  for (const position of positions) {
    expect(position.icon).toBe(positions[0]?.icon);
    expect(position.text).toBe(positions[0]?.text);
  }
}

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
  await expectAlignedNavigation(page.locator(".sidebar nav .nav-row"));
  await expect(page.getByRole("button", { name: "TK 专区", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
  const expand = page.getByRole("button", { name: "展开导航栏", exact: true });
  await expect(expand).toHaveAttribute("aria-expanded", "false");

  await expect
    .poll(async () => Math.round((await page.locator(".sidebar").boundingBox())?.width ?? 0))
    .toBe(64);
  const images = page.getByRole("button", { name: "创作", exact: true });
  await images.focus();
  await images.press("ArrowDown");
  const chooser = page.getByRole("menu", { name: "创作", exact: true });
  await expect(chooser).toBeVisible();
  const panel = await chooser.boundingBox();
  const sidebar = await page.locator(".sidebar").boundingBox();
  expect(panel && sidebar && panel.x >= sidebar.width - 1).toBeTruthy();
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
  await expectAlignedNavigation(mobileNav.locator("nav .nav-row"));
  await expect(mobileNav.getByRole("button", { name: "TK 专区", exact: true })).toHaveCount(0);
  await mobileNav.getByRole("button", { name: "关闭导航", exact: true }).click();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
});
