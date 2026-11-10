import { expect, test } from "@playwright/test";
import { mockImageApi, modelDisplayNames } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("create workspace fills the viewport and pins generation to the composer bottom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1328, height: 906 });
  await page.goto("/commerce/create");
  const composer = page.getByRole("region", { name: "创作设置", exact: true });
  const results = page.getByRole("region", { name: "工作区历史记录", exact: true });
  const generate = page.getByRole("button", { name: /生成商品主图/ });
  const composerBox = await composer.boundingBox();
  const resultsBox = await results.boundingBox();
  const buttonBox = await generate.boundingBox();
  expect(composerBox).not.toBeNull();
  expect(resultsBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  if (!composerBox || !resultsBox || !buttonBox) return;
  const viewport = page.viewportSize();
  const padding = 12;
  // 桌面顶部栏高 64px。
  expect(Math.abs(composerBox.y - (64 + padding))).toBeLessThan(1);
  expect(Math.abs(composerBox.y + composerBox.height - (906 - padding))).toBeLessThan(1);
  expect(Math.abs(resultsBox.y + resultsBox.height - (906 - padding))).toBeLessThan(1);
  expect(
    Math.abs(buttonBox.y + buttonBox.height - (composerBox.y + composerBox.height - padding)),
  ).toBeLessThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
    viewport?.height ?? 0,
  );
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

test("current draft, references and output choices follow model switches and survive navigation", async ({
  page,
}) => {
  await page.goto("/commerce/create");
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await prompt.fill("保留我的商品草稿");
  const ratioPicker = page.getByRole("region", { name: "图片比例", exact: true });
  await ratioPicker.getByRole("button", { name: "下一页画面比例", exact: true }).click();
  await ratioPicker.getByRole("radio", { name: "3:4", exact: true }).click();
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "quilt.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: /创作模型/ }).click();
  await expect(page.getByRole("option")).toHaveCount(4);
  await page.getByRole("option", { name: "Banana 2.1", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "Image 2", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
  await expect(
    page
      .getByRole("region", { name: "图片比例", exact: true })
      .getByRole("radio", { name: "3:4", exact: true }),
  ).toHaveAttribute("data-selected", "true");
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("link", { name: "素材库", exact: true }).click();
  await expect(page.getByRole("heading", { name: "素材库", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "电商", exact: true }).click();
  await page.getByRole("menuitem", { name: "主图制作", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
});

test("invalid references and limit errors do not destroy valid images", async ({ page }) => {
  await page.goto("/commerce/create");
  const input = page.getByLabel("添加参考图片", { exact: true });
  await input.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("图片无法读取");
  await input.setInputFiles({ name: "valid.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await input.setInputFiles([
    "apps/web/public/studio/commerce-atlas.webp",
    "apps/web/public/studio/bedroom.webp",
    "apps/web/public/studio/lavender.webp",
    "apps/web/public/studio/set.webp",
    "apps/web/public/studio/bedroom-thumb.webp",
  ]);
  await expect(page.getByRole("alert")).toContainText("最多添加 5 张");
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.locator(".reference-tile").first().hover();
  await page.getByRole("button", { name: "移除参考图：图片1" }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(0);
});

test("text generation requires a prompt and an available model", async ({ page }) => {
  await page.goto("/commerce/create");
  const generate = page.getByRole("button", { name: "生成商品主图", exact: true });
  await expect(generate).toBeDisabled();
  await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("米白陶瓷杯");
  await expect(generate).toBeEnabled();
  await expect(page.getByRole("radio", { name: "1.5K", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("radio", { name: "2K", exact: true })).toBeEnabled();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`responsive signed-in pages and model chooser stay reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/commerce/create", "/assets"]) {
      await page.goto(path);
      await expect(page.locator(".header-credits")).toBeVisible();
      await expect(
        page.locator("header").getByRole("button", { name: /任务中心|通知/ }),
      ).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.goto("/");
    await page.getByRole("button", { name: "选择创作模型", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "模型和画面设置", exact: true });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    await dialog.getByRole("button", { name: /Banana 2.1/ }).click();
    await dialog.press("Escape");
    await page.getByRole("textbox", { name: "创作需求" }).fill("商品摄影");
    await page.getByRole("button", { name: "开始创作", exact: true }).click();
    await expect(page).toHaveURL(/\/commerce\/create$/);
  });
}

test("tool shortcuts open their workspace", async ({ page }) => {
  await page.goto("/commerce/create");
  await page
    .getByRole("navigation", { name: "电商创作工具" })
    .getByRole("button", { name: "主图制作", exact: true })
    .click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByLabel("提示词", { exact: true })).toBeVisible();
});

test("extended ratios preserve selection and composer scroll stays independent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/commerce/create");
  await expect(page.getByText("更多设置", { exact: true })).toHaveCount(0);
  const ratioPicker = page.getByRole("region", { name: "图片比例", exact: true });
  const track = ratioPicker.locator(".home-ratio-track");
  await expect(ratioPicker.getByRole("radio")).toHaveCount(8);
  await expect(ratioPicker.getByRole("radio", { name: "4:5", exact: true })).toHaveCount(0);
  await ratioPicker.getByRole("button", { name: "下一页画面比例", exact: true }).click();
  await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await ratioPicker.getByRole("radio", { name: "21:9", exact: true }).click();
  await expect(ratioPicker.getByRole("radio", { name: "21:9", exact: true })).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(
    ratioPicker.getByRole("button", { name: "上一页画面比例", exact: true }),
  ).toBeVisible();
  const parameters = page.getByRole("region", { name: "创作参数", exact: true });
  const generate = page.getByRole("button", { name: "生成商品主图", exact: true });
  const before = await generate.boundingBox();
  const pageScroll = await page.evaluate(() => window.scrollY);
  await parameters.hover();
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => parameters.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  const after = await generate.boundingBox();
  expect(before && after && Math.abs(before.y - after.y)).toBeLessThan(1);
  await expect(generate).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      track.evaluate((node) => {
        const selected = node.querySelector('[data-selected="true"]');
        if (!(selected instanceof HTMLElement)) return false;
        const selectedRect = selected.getBoundingClientRect();
        const trackRect = node.getBoundingClientRect();
        return selectedRect.left >= trackRect.left - 1 && selectedRect.right <= trackRect.right + 1;
      }),
    )
    .toBe(true);
});

test("reference limit and clearing remain consistent when switching models", async ({ page }) => {
  await page.goto("/commerce/create");
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await prompt.fill("保留提示词");
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles([
      "apps/web/public/studio/commerce-atlas.webp",
      "apps/web/public/studio/bedroom.webp",
      "apps/web/public/studio/lavender.webp",
      "apps/web/public/studio/set.webp",
      "apps/web/public/studio/bedroom-thumb.webp",
    ]);
  await expect(page.locator(".reference-tile")).toHaveCount(5);
  await expect(page.locator(".reference-number")).toHaveText(["1", "2", "3", "4", "5"]);
  await expect(page.getByText("quilt-0.png", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toHaveCount(0);
  const remove = page.getByRole("button", { name: "移除参考图：图片1", exact: true });
  await expect(remove).toHaveCSS("opacity", "0");
  await page.locator(".reference-tile").first().hover();
  await expect(remove).toHaveCSS("opacity", "1");
  await remove.click();
  await expect(page.locator(".reference-number")).toHaveText(["1", "2", "3", "4"]);
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "Banana 2.1", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.locator(".reference-tile")).toHaveCount(4);
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "Image 2", exact: true }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(4);
  await expect(prompt).toHaveValue("保留提示词");
  await page.getByRole("button", { name: "清除全部参考图片", exact: true }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(0);
  await expect(prompt).toHaveValue("保留提示词");
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "Banana 2.1", exact: true }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(0);
});

test("all three public models switch without changing the workspace URL or the current prompt", async ({
  page,
}) => {
  const models = modelDisplayNames;
  await page.goto("/commerce/create");
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await prompt.fill("同一份商品草稿");
  for (const model of models) {
    await page.getByRole("button", { name: /创作模型/ }).click();
    await expect(page.getByRole("option")).toHaveText(models);
    await page.getByRole("option", { name: model, exact: true }).click();
    await expect(page).toHaveURL(/\/commerce\/create$/);
    await expect(prompt).toHaveValue("同一份商品草稿");
  }
  for (const model of models) {
    await page.getByRole("button", { name: /创作模型/ }).click();
    await page.getByRole("option", { name: model, exact: true }).click();
    await expect(prompt).toHaveValue("同一份商品草稿");
  }
});
