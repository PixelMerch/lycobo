import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("workspace navigation remains compact and aligned across desktop and mobile", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 1584, height: 993 });
  await page.goto("/create");
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

for (const mobile of [false, true]) {
  test(`signed-out navigation hides account settings and preserves drafts on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1584, height: 993 });
    await page.goto("/create");
    const prompt = page.getByLabel("提示词", { exact: true });
    await prompt.fill("保留未登录的创作草稿");
    if (mobile) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    const navigation = page.locator(mobile ? ".mobile-nav" : ".sidebar");
    await expect(page.getByRole("button", { name: "帮助中心", exact: true })).toHaveCount(0);
    await expect(navigation.getByRole("button", { name: "账户设置", exact: true })).toHaveCount(0);
    if (mobile) await navigation.getByRole("button", { name: "关闭导航", exact: true }).click();
    await expect(prompt).toHaveValue("保留未登录的创作草稿");
    await expect(page).toHaveURL(/\/create$/);
  });
}

test("signed-out asset library opens login instead of an unavailable state", async ({ page }) => {
  await mockImageApi(page);
  await page.route("**/api/v1/image-session", (route) =>
    route.fulfill({ status: 401, json: { message: "请先登录" } }),
  );
  await page.goto("/assets");
  const login = page.getByRole("dialog", { name: "欢迎使用 Lycobo", exact: true });
  await expect(login).toBeVisible();
  await expect(page.getByText("素材暂时不可用", { exact: true })).toHaveCount(0);
  await expect(page.getByText("请先登录", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "重新加载", exact: true })).toHaveCount(0);
  await login.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});
