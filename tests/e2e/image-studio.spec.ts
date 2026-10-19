import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("drafts, references and output choices stay independent per model and survive page navigation", async ({
  page,
}) => {
  await page.goto("/create/gpt-image");
  const prompt = page.getByLabel("画面要求", { exact: true });
  await prompt.fill("保留我的商品草稿");
  await page.getByRole("button", { name: "展开全部图片比例", exact: true }).click();
  await page.getByRole("button", { name: "图片比例 3:4", exact: true }).click();
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "quilt.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: /创作模型/ }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("option", { name: "香蕉模型", exact: true }).click();
  await expect(prompt).toHaveValue("");
  await prompt.fill("香蕉模型的另一份草稿");
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "GPT Image", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
  await expect(page.getByRole("button", { name: "更多图片比例", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("link", { name: "素材库", exact: true }).click();
  await expect(page.getByRole("img", { name: "quilt.png" })).toBeVisible();
  await page.getByRole("button", { name: "图片创作", exact: true }).click();
  await page.getByRole("button", { name: "进入 GPT Image 创作" }).click();
  await expect(prompt).toHaveValue("保留我的商品草稿");
});

test("invalid references and limit errors do not destroy valid images", async ({ page }) => {
  await page.goto("/create/gpt-image");
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
  await page.getByRole("button", { name: "移除参考图：valid.png" }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(0);
});

test("case navigation never replaces draft, favorites filter and download operate on real sample assets", async ({
  page,
}) => {
  const generationRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET")
      generationRequests.push(request.url());
  });
  await page.goto("/create/gpt-image");
  const prompt = page.getByLabel("画面要求", { exact: true });
  await prompt.fill("不要覆盖这段输入");
  await page.getByRole("button", { name: "定位案例：浅紫配色" }).click();
  await expect(prompt).toHaveValue("不要覆盖这段输入");
  await expect(page.getByRole("heading", { name: "浅紫配色", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  await page.getByText("仅看收藏", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "仅看收藏", exact: true })).toBeChecked();
  await expect(page.locator(".history-thumb")).toHaveCount(1);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("lycoboai-浅紫配色.webp");
  await page.getByRole("tab", { name: "历史记录", exact: true }).click();
  await expect(page.getByText("还没有生成记录")).toBeVisible();
  await page.getByRole("button", { name: "任务中心", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "任务中心", exact: true });
  await expect(drawer.getByText("暂无任务")).toBeVisible();
  await drawer.press("Escape");
  await expect(page.getByRole("button", { name: "任务中心", exact: true })).toBeFocused();
  expect(generationRequests).toEqual([]);
});

test("case reuse requires confirmation before replacing an existing draft", async ({ page }) => {
  await page.goto("/create/gpt-image");
  await page.getByLabel("画面要求", { exact: true }).fill("重要草稿");
  await page.getByRole("link", { name: "首页", exact: true }).first().click();
  await page.getByRole("button", { name: "查看案例：原木卧室" }).click();
  const dialog = page.getByRole("dialog", { name: "原木卧室", exact: true });
  await dialog.getByRole("button", { name: "使用 GPT Image 创作" }).click();
  await expect(dialog.getByRole("alert")).toContainText("已有草稿");
  await dialog.getByRole("button", { name: "保留草稿" }).click();
  await dialog.press("Escape");
  await page
    .getByRole("link", { name: /进入创作/ })
    .first()
    .click();
  await expect(page.getByLabel("画面要求", { exact: true })).toHaveValue("重要草稿");
});

test("responsive pages, model chooser and global tasks stay reachable without horizontal overflow", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/create/gpt-image", "/assets"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "任务中心", exact: true })).toBeVisible();
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
    await page.getByRole("button", { name: "进入 香蕉模型 创作" }).click();
    await expect(page).toHaveURL(/\/create\/banana$/);
  }
});

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
  await chooser.getByRole("button", { name: "进入 香蕉模型 创作" }).locator("img").click();
  await expect(page).toHaveURL(/\/create\/banana$/);
  await expect(page.getByLabel("画面要求", { exact: true })).toBeVisible();
});

test("extended ratios preserve selection and composer scroll stays independent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/create/gpt-image");
  await expect(page.getByText("更多设置", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "更多图片比例", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "更多图片比例", exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("button", { name: /^图片比例 / })).toHaveCount(6);
  await expect(picker.getByRole("button", { name: "图片比例 4:5", exact: true })).toHaveCount(0);
  await picker.getByRole("button", { name: "图片比例 9:16", exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(page.getByRole("button", { name: "更多图片比例", exact: true })).toContainText(
    "9:16",
  );
  await page.getByRole("button", { name: "展开全部图片比例", exact: true }).click();
  await picker.press("Escape");
  await expect(page.getByRole("button", { name: "展开全部图片比例", exact: true })).toBeFocused();
  const parameters = page.getByRole("region", { name: "创作参数", exact: true });
  const generate = page.getByRole("button", { name: "生成图片", exact: true });
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
