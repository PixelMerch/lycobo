import { expect, test } from "@playwright/test";
import { chooseWorkspaceTool, mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("workspace switches tools without discarding drafts and remembers the current tool", async ({
  page,
}) => {
  await page.goto("/commerce/create");
  await page.getByLabel("提示词", { exact: true }).fill("保留我的商品草稿");
  await chooseWorkspaceTool(page, "家纺裂变");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await chooseWorkspaceTool(page, "主图制作");
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("保留我的商品草稿");
});

test("video is absent from the tool menu and its direct route does not trigger paid work", async ({
  page,
}) => {
  const submissions: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("image-tasks")) submissions.push(r.url());
  });
  await page.goto("/commerce/create");
  await expect(
    page.getByRole("navigation", { name: "电商创作工具" }).getByRole("button", { name: /视频/ }),
  ).toHaveCount(0);
  await page.goto("/zh-CN/dashboard/video");
  await expect(page).toHaveURL(/\/video$/);
  await expect(page.getByRole("button", { name: /立即生成.*100/ })).toBeDisabled();
  expect(submissions).toEqual([]);
});

test("legacy commerce links redirect to the homepage and workspace routes remain available", async ({
  page,
}) => {
  await page.goto("/zh-CN/commerce?tool=replica#commerce-composer");
  await expect(page).toHaveURL(/\/zh-CN\?tool=replica#commerce-composer$/);
  await expect(page.locator("iframe.openart-reference")).toBeVisible();
  await page.goto("/zh-CN/commerce/replica");
  await expect(page).toHaveURL(/\/zh-CN\/dashboard\/commerce\/replica$/);
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/commerce\/replica$/);
});

test("tool-scoped history follows navigation and preserves the main-image draft", async ({
  page,
}) => {
  const filters: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/image-tasks" && request.method() === "GET")
      filters.push(url.searchParams.get("tool") ?? "all");
  });
  await page.goto("/commerce/create");
  await page.getByLabel("提示词", { exact: true }).fill("保留商品描述");
  await expect(page.getByRole("combobox", { name: "历史工具筛选" })).toHaveCount(0);
  await chooseWorkspaceTool(page, "家纺裂变");
  await expect.poll(() => filters.includes("textile")).toBe(true);
  await chooseWorkspaceTool(page, "主图制作");
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("保留商品描述");
  expect(filters).not.toContain("all");
});
