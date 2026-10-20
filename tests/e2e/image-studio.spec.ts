import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("current draft, references and output choices follow model switches and survive navigation", async ({
  page,
}) => {
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留我的商品草稿");
  await page.getByRole("button", { name: "展开全部图片比例", exact: true }).click();
  await page
    .getByRole("dialog", { name: "更多图片比例", exact: true })
    .getByRole("radio", { name: "3:4", exact: true })
    .click();
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "quilt.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: /创作模型/ }).click();
  await expect(page.getByRole("option")).toHaveCount(5);
  await page.getByRole("option", { name: "gpt-image-2-4K", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "gpt-image-2", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
  await expect(page.getByRole("button", { name: "更多图片比例", exact: true })).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("link", { name: "素材库", exact: true }).click();
  await expect(page.getByRole("heading", { name: "素材库", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "图片创作", exact: true }).click();
  await page.getByRole("button", { name: "进入 gpt-image-2 创作" }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
});

test("invalid references and limit errors do not destroy valid images", async ({ page }) => {
  await page.goto("/create");
  const input = page.getByLabel("添加参考图片", { exact: true });
  await input.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toContainText("图片无法读取");
  await input.setInputFiles({ name: "valid.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await input.setInputFiles(
    Array.from({ length: 5 }, (_, i) => ({ name: `${i}.png`, mimeType: "image/png", buffer: png })),
  );
  await expect(page.getByRole("alert")).toContainText("最多添加 5 张");
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: "移除参考图：图片1" }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(0);
});

test("text generation requires a prompt and an available model", async ({ page }) => {
  await page.goto("/create");
  const generate = page.getByRole("button", { name: "立即生成", exact: true });
  await expect(generate).toBeDisabled();
  await page.getByLabel("提示词", { exact: true }).fill("米白陶瓷杯");
  await expect(generate).toBeEnabled();
  await expect(page.getByRole("radio", { name: "1K", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("radio", { name: "2K", exact: true })).toBeDisabled();
});

test("case reuse requires confirmation before replacing an existing draft", async ({ page }) => {
  await page.goto("/create");
  await page.getByLabel("提示词", { exact: true }).fill("重要草稿");
  await page.getByRole("link", { name: "首页", exact: true }).first().click();
  await page.getByRole("button", { name: "查看案例：原木卧室" }).click();
  const dialog = page.getByRole("dialog", { name: "原木卧室", exact: true });
  await dialog.getByRole("button", { name: "使用 gpt-image-2 创作" }).click();
  await expect(dialog.getByRole("alert")).toContainText("已有草稿");
  await dialog.getByRole("button", { name: "保留草稿" }).click();
  await dialog.press("Escape");
  await page
    .getByRole("link", { name: /进入创作/ })
    .first()
    .click();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("重要草稿");
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`responsive pages, model chooser and login stay reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/create", "/assets"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toBeVisible();
      await expect(
        page.locator("header").getByRole("button", { name: /任务中心|通知/ }),
      ).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.goto("/");
    await page.getByRole("button", { name: "开始创作", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "图片创作", exact: true });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    await page.getByRole("button", { name: "进入 gpt-image-2-4K 创作" }).click();
    await expect(page).toHaveURL(/\/create$/);
  });
}

test("compact model cards open from their covers and case cards restore focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "图片创作", exact: true });
  const caseCard = chooser.getByRole("button", { name: "查看案例：原木卧室" });
  await caseCard.click();
  const detail = page.getByRole("dialog", { name: "原木卧室", exact: true });
  await expect(detail).toBeVisible();
  await detail.press("Escape");
  await expect(caseCard).toBeFocused();
  await chooser.getByRole("button", { name: "进入 gpt-image-2-4K 创作" }).locator("img").click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByLabel("提示词", { exact: true })).toBeVisible();
});

test("extended ratios preserve selection and composer scroll stays independent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/create");
  await expect(page.getByText("更多设置", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "更多图片比例", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "更多图片比例", exact: true });
  await expect(picker).toBeVisible();
  await expect(page.getByRole("button", { name: "展开全部图片比例", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect
    .poll(async () => {
      const group = await page.locator(".ratio-group").boundingBox();
      const popup = await page.locator(".ratio-popover").boundingBox();
      return (
        !!group && !!popup && popup.x >= group.x + group.width && Math.abs(popup.y - group.y) < 1
      );
    })
    .toBe(true);
  await expect(picker.getByRole("radio")).toHaveCount(6);
  await expect(picker.getByRole("radio", { name: "4:5", exact: true })).toHaveCount(0);
  await picker.getByRole("radio", { name: "9:16", exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(page.getByRole("button", { name: "展开全部图片比例", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByRole("button", { name: "更多图片比例", exact: true })).toContainText(
    "9:16",
  );
  await page.getByRole("button", { name: "展开全部图片比例", exact: true }).click();
  await picker.press("Escape");
  await expect(page.getByRole("button", { name: "展开全部图片比例", exact: true })).toBeFocused();
  const parameters = page.getByRole("region", { name: "创作参数", exact: true });
  const generate = page.getByRole("button", { name: "立即生成", exact: true });
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
  await page.getByRole("button", { name: "更多图片比例", exact: true }).click();
  await expect(picker).toBeInViewport({ ratio: 1 });
});

test("reference limit and clearing remain consistent when switching models", async ({ page }) => {
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留提示词");
  await page.getByLabel("添加参考图片", { exact: true }).setInputFiles(
    Array.from({ length: 5 }, (_, i) => ({
      name: `quilt-${i}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await expect(page.locator(".reference-tile")).toHaveCount(5);
  await expect(page.locator(".reference-number")).toHaveText([
    "图片1",
    "图片2",
    "图片3",
    "图片4",
    "图片5",
  ]);
  await expect(page.getByText("quilt-0.png", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "移除参考图：图片1", exact: true }).click();
  await expect(page.locator(".reference-number")).toHaveText(["图片1", "图片2", "图片3", "图片4"]);
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "gpt-image-2-4K", exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator(".reference-tile")).toHaveCount(4);
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "gpt-image-2", exact: true }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(4);
  await expect(prompt).toHaveValue("保留提示词");
  await page.getByRole("button", { name: "清除全部参考图片", exact: true }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(0);
  await expect(prompt).toHaveValue("保留提示词");
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "gpt-image-2-4K", exact: true }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(0);
});

test("all five GPT models switch without changing the workspace URL or the current prompt", async ({
  page,
}) => {
  const models = [
    "gpt-image-2.5",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-sunburst",
    "gpt-image-2",
    "gpt-image-2-4K",
  ];
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("同一份商品草稿");
  for (const model of models) {
    await page.getByRole("button", { name: /创作模型/ }).click();
    await expect(page.getByRole("option")).toHaveText(models);
    await page.getByRole("option", { name: model, exact: true }).click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(prompt).toHaveValue("同一份商品草稿");
  }
  for (const model of models) {
    await page.getByRole("button", { name: /创作模型/ }).click();
    await page.getByRole("option", { name: model, exact: true }).click();
    await expect(prompt).toHaveValue("同一份商品草稿");
  }
});
