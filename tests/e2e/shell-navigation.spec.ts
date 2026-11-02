import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("workspace navigation remains compact and aligned across desktop and mobile", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 1584, height: 993 });
  await page.goto("/create");
  const logo = page.locator(".sidebar .lycobo-logo");
  await expect(logo).toHaveAttribute("src", "/brand/lycobo-fold.svg");
  await expect
    .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    "href",
    "/brand/lycobo-fold-icon.svg",
  );
  expect((await page.request.get("/brand/lycobo-fold-icon.svg")).ok()).toBe(true);
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留这份商品创作草稿");
  const rows = page.locator(".sidebar nav .nav-row");
  await expect(rows).toHaveText(["首页", "工作区", "素材库"]);
  const positions = await rows.evaluateAll((nodes) =>
    nodes.map((node) => ({
      icon: node.querySelector(".ui-icon")?.getBoundingClientRect().x,
      text: node.querySelector(".nav-label")?.getBoundingClientRect().x,
    })),
  );
  for (const position of positions) expect(position).toEqual(positions[0]);
  await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
  await expect
    .poll(async () => Math.round((await page.locator(".sidebar").boundingBox())?.width ?? 0))
    .toBe(64);
  const workspace = page.getByRole("link", { name: "工作区", exact: true });
  await workspace.hover();
  await expect(page.getByRole("tooltip", { name: "工作区", exact: true })).toBeVisible();
  await workspace.click();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  const mobile = page.locator(".mobile-nav");
  await expect(mobile.locator("nav .nav-row")).toHaveText(["首页", "工作区", "素材库"]);
  await mobile.getByRole("button", { name: "关闭导航", exact: true }).click();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
});
