import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("workspace switches tools without discarding drafts and remembers the current tool", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByLabel("提示词", { exact: true }).fill("保留我的商品草稿");
  await page.getByRole("button", { name: "全部工具", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "选择工具" });
  await dialog.getByRole("button", { name: /^家纺裂变/ }).click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await page.getByRole("link", { name: "工作区", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await page.getByRole("button", { name: "全部工具", exact: true }).click();
  await dialog.getByRole("button", { name: /^主图制作/ }).click();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("保留我的商品草稿");
});

test("tool search, categories and unavailable tools do not trigger paid work", async ({ page }) => {
  const submissions: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("image-tasks")) submissions.push(r.url());
  });
  await page.goto("/create");
  await page.getByRole("button", { name: "全部工具", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "选择工具" });
  await dialog.getByRole("textbox", { name: "搜索电商工具" }).fill("不存在的工具");
  await expect(dialog.getByText("没有匹配的工具")).toBeVisible();
  await dialog.getByRole("textbox", { name: "搜索电商工具" }).fill("");
  await dialog.getByRole("radio", { name: "商品视频", exact: true }).click();
  const video = dialog.getByRole("button", { name: /^视频创作/ });
  await expect(video).toContainText("768p");
  await video.click();
  await expect(page).toHaveURL(/\/video$/);
  await expect(page.getByRole("button", { name: /立即生成.*100/ })).toBeDisabled();
  expect(submissions).toEqual([]);
});

test("legacy commerce URL remains supported", async ({ page }) => {
  await page.goto("/commerce");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(page.getByRole("button", { name: "全部工具", exact: true })).toBeVisible();
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
  await page.goto("/create");
  await page.getByLabel("提示词", { exact: true }).fill("保留商品描述");
  await expect(page.getByRole("combobox", { name: "历史工具筛选" })).toHaveCount(0);
  const tools = page.getByRole("navigation", { name: "电商创作工具" });
  await tools.getByRole("button", { name: "家纺裂变", exact: true }).click();
  await expect.poll(() => filters.includes("textile")).toBe(true);
  await tools.getByRole("button", { name: "主图制作", exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("保留商品描述");
  expect(filters).not.toContain("all");
});
