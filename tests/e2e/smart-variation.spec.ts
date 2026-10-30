import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("smart variation keeps drafts and edits examples without submitting paid work", async ({
  page,
}) => {
  const submissions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /image-tasks|variation.*plans/.test(request.url()))
      submissions.push(request.url());
  });
  await page.goto("/commerce/smart-variation");
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "product.png", mimeType: "image/png", buffer: png });
  await page
    .getByRole("textbox", { name: "创作需求", exact: true })
    .fill("将商品换成橙色，保留白色部分");
  await expect(page.getByRole("button", { name: "生成计划", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "查看计划示例", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "确认每张图的中文提示词", exact: true });
  await expect(dialog).toContainText("示例计划");
  await expect(dialog.locator(".variation-plan-card")).toHaveCount(9);
  await dialog.getByRole("textbox", { name: "方案 1 名称", exact: true }).fill("保留花纹的橙色款");
  await dialog
    .getByRole("textbox", { name: "方案 1 提示词", exact: true })
    .fill("只调整主色，保留白色与商品花纹。");
  await dialog
    .getByRole("region", { name: "方案 2", exact: true })
    .locator(".checkbox__content")
    .click();
  await expect(dialog.getByRole("checkbox", { name: "选择方案 2", exact: true })).not.toBeChecked();
  await expect(dialog).toContainText("已选 8 张");
  await dialog.getByRole("button", { name: "删除方案 3", exact: true }).click();
  await expect(dialog.locator(".variation-plan-card")).toHaveCount(8);
  await expect(dialog).toContainText("已选 7 张");
  await expect(dialog.getByRole("button", { name: "开始生成", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "查看计划示例", exact: true })).toBeFocused();
  await page
    .getByRole("navigation", { name: "电商创作工具" })
    .getByRole("button", { name: "主图制作", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "电商创作工具" })
    .getByRole("button", { name: "智能裂变", exact: true })
    .click();
  await expect(page).toHaveURL(/\/commerce\/smart-variation$/);
  await expect(page.getByRole("textbox", { name: "创作需求", exact: true })).toHaveValue(
    "将商品换成橙色，保留白色部分",
  );
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: "查看计划示例", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "方案 1 名称", exact: true })).toHaveValue(
    "保留花纹的橙色款",
  );
  await expect(dialog.getByRole("textbox", { name: "方案 1 提示词", exact: true })).toHaveValue(
    "只调整主色，保留白色与商品花纹。",
  );
  await dialog.getByRole("button", { name: "恢复示例", exact: true }).click();
  await expect(dialog.locator(".variation-plan-card")).toHaveCount(9);
  expect(submissions).toEqual([]);
});

for (const width of [1440, 390, 320]) {
  test(`plan overlay remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/smart-variation");
    await page.getByRole("button", { name: "查看计划示例", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "确认每张图的中文提示词", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "关闭套图生成计划", exact: true }),
    ).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "开始生成", exact: true })).toBeInViewport();
    await dialog
      .getByRole("textbox", { name: "方案 9 提示词", exact: true })
      .fill("第九张示例的修改内容");
    await expect(dialog.getByRole("button", { name: "开始生成", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/lycobo-smart-plan-${width}.png` });
  });
}
