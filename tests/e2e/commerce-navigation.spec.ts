import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("workspace switches tools without discarding drafts and remembers the current tool", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByLabel("制作要求", { exact: true }).fill("保留我的商品草稿");
  await page.getByRole("button", { name: "主图制作 切换", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "选择工具" });
  await dialog.getByRole("button", { name: /^家纺套图/ }).click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await page.getByRole("link", { name: "工作区", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await page.getByRole("button", { name: "家纺套图 切换", exact: true }).click();
  await dialog.getByRole("button", { name: /^主图制作/ }).click();
  await expect(page.getByLabel("制作要求", { exact: true })).toHaveValue("保留我的商品草稿");
});

test("tool search, categories and unavailable tools do not trigger paid work", async ({ page }) => {
  const submissions: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("image-tasks")) submissions.push(r.url());
  });
  await page.goto("/create");
  await page.getByRole("button", { name: "主图制作 切换", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "选择工具" });
  await dialog.getByRole("textbox", { name: "搜索电商工具" }).fill("不存在的工具");
  await expect(dialog.getByText("没有匹配的工具")).toBeVisible();
  await dialog.getByRole("textbox", { name: "搜索电商工具" }).fill("");
  await dialog.getByRole("radio", { name: "商品视频", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /商品视频/ })).toBeDisabled();
  expect(submissions).toEqual([]);
});

test("legacy commerce URL remains supported", async ({ page }) => {
  await page.goto("/commerce");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(page.getByRole("button", { name: "家纺套图 切换", exact: true })).toBeVisible();
});

test("history filtering leaves the active tool and draft unchanged", async ({ page }) => {
  const filters: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/image-tasks" && request.method() === "GET") {
      filters.push(url.searchParams.get("tool") ?? "all");
    }
  });
  await page.goto("/create");
  await page.getByLabel("制作要求", { exact: true }).fill("保留商品描述");
  const filter = page.getByRole("combobox", { name: "历史工具筛选" });
  await filter.fill("家纺");
  await page.getByRole("option", { name: "家纺套图", exact: true }).click();
  await expect.poll(() => filters.includes("textile")).toBe(true);
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByLabel("制作要求", { exact: true })).toHaveValue("保留商品描述");
});
