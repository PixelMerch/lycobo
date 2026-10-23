import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("textile form has only required product inputs and retains confirmed choices across navigation", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  const form = page.getByRole("region", { name: "家纺套图参数", exact: true });
  await expect(page.getByLabel("主图文件", { exact: true })).toHaveAttribute("required", "");
  await expect(page.getByLabel("详情图文件", { exact: true })).not.toHaveAttribute("required");
  for (const label of ["模型", "质量", "生成张数", "分辨率", "提示词"])
    await expect(form.getByText(label, { exact: true })).toHaveCount(0);
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
  await expect(form.locator(".reference-tile")).toHaveCount(1);
  await form.getByRole("button", { name: "选择裂变类型", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
  await expect(dialog.locator(".textile-view-card")).toHaveCount(10);
  await expect(dialog.locator("img")).toHaveCount(0);
  await expect(dialog.locator(".textile-view-example")).toHaveCount(10);
  await dialog.getByRole("button", { name: "正面", exact: true }).click();
  await dialog.getByRole("button", { name: "面料特写", exact: true }).click();
  await expect(dialog).toContainText("已选 2 个视角");
  await dialog.getByRole("button", { name: "确定", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(form.getByRole("button", { name: "选择裂变类型", exact: true })).toContainText(
    "正面、面料特写",
  );
  const ratios = form.getByRole("region", { name: "图片比例", exact: true });
  await ratios.getByRole("button", { name: "下一页画面比例", exact: true }).click();
  await ratios.getByRole("radio", { name: "3:4", exact: true }).click();
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "创作", exact: true }).click();
  await page.getByRole("link", { name: "AI 电商", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(form.locator(".reference-tile")).toHaveCount(1);
  await expect(form.getByRole("button", { name: "选择裂变类型", exact: true })).toContainText(
    "正面、面料特写",
  );
  await expect(ratios.getByRole("radio", { name: "3:4", exact: true })).toHaveAttribute(
    "data-selected",
    "true",
  );
  await form.getByRole("button", { name: "查看参考图片：图片1", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "图片浏览", exact: true });
  await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

test("view reset and dismiss do not overwrite the confirmed selection", async ({ page }) => {
  await page.goto("/commerce/textile-set");
  const opener = page.getByRole("button", { name: "选择裂变类型", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
  await dialog.getByRole("button", { name: "枕头特写", exact: true }).click();
  await dialog.getByRole("button", { name: "确定", exact: true }).click();
  await opener.click();
  await dialog.getByRole("button", { name: "重置", exact: true }).click();
  await expect(dialog).toContainText("已选 0 个视角");
  await page.keyboard.press("Escape");
  await expect(opener).toContainText("枕头特写");
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog.getByRole("button", { name: "枕头特写", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByRole("button", { name: "重置", exact: true }).click();
  await dialog.getByRole("button", { name: "确定", exact: true }).click();
  await expect(opener).toHaveText("选择裂变类型");
});

test("main and optional detail images validate independently and clear without affecting each other", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
  await page
    .getByLabel("详情图文件", { exact: true })
    .setInputFiles({ name: "detail.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not image") });
  await expect(page.getByRole("alert")).toContainText("图片无法读取");
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await page.getByRole("button", { name: "清除主图", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "主图", exact: true }).locator(".reference-tile"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "详情图", exact: true }).locator(".reference-tile"),
  ).toHaveCount(1);
});

for (const width of [1440, 390]) {
  test(`textile workspace and view dialog remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/textile-set");
    await expect(page.getByRole("region", { name: "家纺套图参数", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "家纺套图内容", exact: true })).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "家纺套图历史索引", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "选择裂变类型", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
    await dialog.getByRole("button", { name: "面料特写", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "面料特写", exact: true })).toHaveCSS(
      "outline-style",
      "none",
    );
    await dialog.getByRole("button", { name: "确定", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
