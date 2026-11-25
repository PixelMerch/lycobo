import { expect, test } from "@playwright/test";
import { chooseWorkspaceTool, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("textile form has only required product inputs and retains confirmed choices across navigation", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  const form = page.getByRole("region", { name: "家纺裂变参数", exact: true });
  await expect(page.getByLabel("主图文件", { exact: true })).toHaveAttribute("required", "");
  await expect(page.getByLabel("主图文件", { exact: true })).not.toHaveAttribute("multiple");
  await expect(page.getByLabel("详情图文件", { exact: true })).toHaveAttribute("multiple", "");
  await expect(page.getByLabel("详情图文件", { exact: true })).not.toHaveAttribute("required");
  await expect(page.locator(".workspace-fixed-model")).toHaveCount(0);
  for (const label of ["质量", "生成张数", "提示词"])
    await expect(form.getByText(label, { exact: true })).toHaveCount(0);
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
  await expect(form.locator(".reference-tile")).toHaveCount(1);
  await expect(form.locator(".reference-number")).toHaveCount(0);
  await expect(form.getByRole("button", { name: /更换/ })).toHaveCount(0);
  await form.getByRole("button", { name: "选择裂变类型", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
  await expect(dialog.locator(".textile-view-card")).toHaveCount(10);
  await expect(dialog.locator("img")).toHaveCount(10);
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth === 480 &&
              image.naturalHeight === 480,
          ),
        ),
    )
    .toBe(true);
  await expect(dialog.locator(".textile-view-example")).toHaveCount(10);
  await expect(dialog.locator(".textile-view-example").first()).toHaveCSS("aspect-ratio", "3 / 4");
  await page.screenshot({ path: "/tmp/lycobo-textile-view-examples.png" });
  await dialog.getByRole("button", { name: "正面", exact: true }).click();
  await dialog.getByRole("button", { name: "面料特写", exact: true }).click();
  await expect(dialog).toContainText("已选 2 个视角");
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(form.locator(".textile-selected-view")).toHaveCount(2);
  await expect(form.locator(".textile-selected-name")).toHaveText(["正面", "面料特写"]);
  await expect(form.locator(".textile-selected-example img").first()).toHaveAttribute(
    "src",
    "/studio/textile-views/front.webp",
  );
  const ratios = form.getByRole("region", { name: "图片比例", exact: true });
  await ratios.getByRole("button", { name: "下一页画面比例", exact: true }).click();
  await ratios.getByRole("radio", { name: "3:4", exact: true }).click();
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeEnabled();
  await chooseWorkspaceTool(page, "主图制作");
  await chooseWorkspaceTool(page, "家纺裂变");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(form.locator(".reference-tile")).toHaveCount(1);
  await expect(form.locator(".textile-selected-view")).toHaveCount(2);
  await expect(form.locator(".textile-selected-name")).toHaveText(["正面", "面料特写"]);
  await expect(ratios.getByRole("radio", { name: "3:4", exact: true })).toHaveAttribute(
    "data-selected",
    "true",
  );
  await form
    .getByRole("button", { name: "查看参考图片：图片1", exact: true })
    .click({ position: { x: 12, y: 56 } });
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
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await opener.click();
  await dialog.getByRole("button", { name: "重置", exact: true }).click();
  await expect(dialog).toContainText("已选 0 个视角");
  await page.keyboard.press("Escape");
  await expect(page.locator(".textile-selected-name")).toHaveText(["枕头特写"]);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog.getByRole("button", { name: "枕头特写", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByRole("button", { name: "正面", exact: true }).click();
  await page.locator(".workspace-composer-title").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".textile-selected-name")).toHaveText(["枕头特写"]);
  await opener.click();
  await expect(dialog.getByRole("button", { name: "正面", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(dialog.getByRole("button", { name: "枕头特写", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByRole("button", { name: "重置", exact: true }).click();
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(opener).toHaveText("选择裂变类型");
});

test("main and optional detail images validate independently and clear without affecting each other", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  await expect(page.getByRole("button", { name: "清除主图", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除详情图", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除裂变类型", exact: true })).toHaveCount(0);
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
  await page
    .getByLabel("详情图文件", { exact: true })
    .setInputFiles({ name: "detail.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await page.getByLabel("主图文件", { exact: true }).evaluate((input) => {
    if (!(input instanceof HTMLInputElement)) throw new Error("Expected file input");
    const files = new DataTransfer();
    files.items.add(new File(["first"], "first.png", { type: "image/png" }));
    files.items.add(new File(["second"], "second.png", { type: "image/png" }));
    input.files = files.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("alert")).toContainText("每次只能上传一张图片");
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not image") });
  await expect(page.getByRole("alert")).toContainText("第 1 张图片无法解码");
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await page.getByRole("button", { name: "清除主图", exact: true }).click();
  await expect(page.getByRole("button", { name: "清除主图", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除详情图", exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "主图", exact: true }).locator(".reference-tile"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "详情图", exact: true }).locator(".reference-tile"),
  ).toHaveCount(1);
});

for (const width of [2560, 1440, 390]) {
  test(`textile workspace and view dialog remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/textile-set");
    await expect(page.getByRole("region", { name: "家纺裂变参数", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "工作区历史记录", exact: true })).toBeVisible({
      visible: width >= 768,
    });
    await expect(
      page.getByRole("complementary", { name: "家纺裂变历史索引", exact: true }),
    ).toBeVisible({
      visible: width >= 768,
    });
    const opener = page.getByRole("button", { name: "选择裂变类型", exact: true });
    // On a phone the panel hero can leave the opener just below the fold. Let that scroll
    // dispatch before opening, because the non-modal popover closes when the page scrolls.
    await opener.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
    if (width === 2560) {
      await expect
        .poll(() =>
          dialog
            .locator("img")
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      await page.screenshot({ path: "/tmp/lycobo-textile-adaptive.png" });
    }
    const box = await dialog.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
    // 非模态浮层不加全屏遮罩；面板自身使用共享玻璃材质。
    await expect(page.locator(".modal__backdrop")).toHaveCount(0);
    await expect(page.locator(".textile-views-popover")).toHaveCSS("backdrop-filter", "blur(40px)");
    const form = page.getByRole("region", { name: "家纺裂变参数", exact: true });
    expect(await form.evaluate((el) => el.closest('[aria-hidden="true"], [inert]') === null)).toBe(
      true,
    );
    if (width >= 768) {
      const formBox = await form.boundingBox();
      expect(box && formBox && box.x >= formBox.x + formBox.width).toBeTruthy();
    }
    if (width > 1300) {
      const railBox = await page
        .getByRole("complementary", { name: "家纺裂变历史索引", exact: true })
        .boundingBox();
      expect(box && railBox && box.x + box.width <= railBox.x).toBeTruthy();
      await expect(page.getByRole("button", { name: "打开素材库", exact: true })).toBeInViewport();
    }
    const cards = await dialog
      .locator(".textile-view-card")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    const firstTop = cards[0];
    expect(firstTop).toBeDefined();
    const firstRow = cards.filter((top) => firstTop !== undefined && Math.abs(top - firstTop) < 1);
    expect(firstRow.length).toBeLessThanOrEqual(5);
    await dialog.getByRole("button", { name: "面料特写", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "面料特写", exact: true })).toHaveCSS(
      "outline-style",
      "none",
    );
    await dialog.getByRole("button", { name: "确认", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("textile view trigger alternates open and closed on repeated clicks", async ({ page }) => {
  await page.goto("/commerce/textile-set");
  const opener = page.getByRole("button", { name: "选择裂变类型", exact: true });
  const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
  await opener.click();
  await expect(dialog).toBeVisible();
  await opener.click();
  await expect(dialog).toBeHidden();
  for (let cycle = 0; cycle < 3; cycle++) {
    await opener.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "正面", exact: true }).click();
    await opener.click();
    await expect(dialog).toBeHidden();
  }
});

test("textile view trigger toggles on repeated touch taps", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("E2E baseURL must be configured.");
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  try {
    await mockImageApi(page);
    await page.goto("/commerce/textile-set");
    const opener = page.getByRole("button", { name: "选择裂变类型", exact: true });
    const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
    for (let cycle = 0; cycle < 3; cycle++) {
      await opener.tap();
      await expect(dialog).toBeVisible();
      await opener.tap();
      await expect(dialog).toBeHidden();
    }
  } finally {
    await context.close();
  }
});

test("confirmed textile views show removable thumbnails and keep picker selection in sync", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  const opener = page.getByRole("button", { name: "选择裂变类型", exact: true });
  const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
  await opener.click();
  await dialog.getByRole("button", { name: "正面", exact: true }).click();
  await dialog.getByRole("button", { name: "面料特写", exact: true }).click();
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.locator(".textile-selected-view")).toHaveCount(2);
  await expect(page.locator(".textile-selected-example")).toHaveCount(2);
  const remove = page.getByRole("button", { name: "移除裂变类型：正面", exact: true });
  await expect(remove).toHaveCSS("opacity", "0");
  await remove.locator("..").hover();
  await expect(remove).toHaveCSS("opacity", "1");
  await remove.click();
  await expect(page.locator(".textile-selected-name")).toHaveText(["面料特写"]);
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog.getByRole("button", { name: "正面", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(dialog.getByRole("button", { name: "面料特写", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Escape");
  const removeLast = page.getByRole("button", { name: "移除裂变类型：面料特写", exact: true });
  await removeLast.focus();
  await expect(removeLast).toHaveCSS("opacity", "1");
  await removeLast.press("Enter");
  await expect(page.locator(".textile-selected-view")).toHaveCount(0);
  await expect(opener).toHaveText("选择裂变类型");
});

test("corner replacement opens the file chooser without opening preview and keeps a single image", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
  const field = page.getByRole("region", { name: "主图", exact: true });
  const image = field.locator(".reference-preview img");
  const previous = await image.getAttribute("src");
  await field.locator(".reference-tile").hover();
  const replace = field.getByRole("button", { name: "替换参考图：图片1", exact: true });
  await expect(replace).toHaveCSS("opacity", "1");
  await expect(replace).toHaveText("");
  await expect(replace.locator("svg")).toHaveCount(1);
  const tileBox = await field.locator(".reference-tile").boundingBox();
  const replaceBox = await replace.boundingBox();
  expect(
    tileBox &&
      replaceBox &&
      Math.abs(tileBox.x + tileBox.width - replaceBox.x - replaceBox.width) < 1,
  ).toBeTruthy();
  expect(
    tileBox &&
      replaceBox &&
      Math.abs(tileBox.y + tileBox.height - replaceBox.y - replaceBox.height) < 1,
  ).toBeTruthy();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), replace.click()]);
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles(".github/ci/browser/fixtures/studio/set-thumb.webp");
  await expect(image).not.toHaveAttribute("src", previous ?? "");
  await expect(field.locator(".reference-tile")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "图片浏览", exact: true })).toBeHidden();
  await field
    .getByRole("button", { name: "查看参考图片：图片1", exact: true })
    .click({ position: { x: 12, y: 56 } });
  await expect(page.getByRole("dialog", { name: "图片浏览", exact: true })).toBeVisible();
});

test("clear textile views removes every selected angle without clearing product images", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "选择裂变类型", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "裂变类型", exact: true });
  for (const name of ["正面", "面料特写"])
    await picker.getByRole("button", { name, exact: true }).click();
  await picker.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.locator(".textile-selected-view")).toHaveCount(2);
  await page.getByRole("button", { name: "清除裂变类型", exact: true }).click();
  await expect(page.locator(".textile-selected-view")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除裂变类型", exact: true })).toHaveCount(0);
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: "选择裂变类型", exact: true }).click();
  await expect(picker).toContainText("已选 0 个视角");
});

test("detail images append up to five, replace individually and clear together", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  const field = page.getByRole("region", { name: "详情图", exact: true });
  const input = page.getByLabel("详情图文件", { exact: true });
  const files = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      name: `detail-${index}.png`,
      mimeType: "image/png",
      buffer: png,
    }));
  await input.setInputFiles(files(3));
  await expect(field.locator(".reference-tile")).toHaveCount(3);
  await input.setInputFiles(files(3));
  await expect(field.getByRole("alert")).toContainText("详情图最多上传 5 张");
  await expect(field.locator(".reference-tile")).toHaveCount(3);
  await input.setInputFiles(files(2));
  await expect(field.locator(".reference-tile")).toHaveCount(5);
  await expect(field.getByRole("button", { name: "添加详情图", exact: true })).toHaveCount(0);
  const first = field.locator(".reference-tile").first();
  const original = await first.locator(".reference-preview img").getAttribute("src");
  await first.hover();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    first.getByRole("button", { name: "替换参考图：图片2", exact: true }).click(),
  ]);
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles(".github/ci/browser/fixtures/studio/set-thumb.webp");
  await expect(first.locator(".reference-preview img")).not.toHaveAttribute("src", original ?? "");
  await expect(field.locator(".reference-tile")).toHaveCount(5);
  await first.getByRole("button", { name: "查看参考图片：图片2", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "图片浏览", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await first.hover();
  await first.getByRole("button", { name: "移除参考图：图片2", exact: true }).click();
  await expect(field.locator(".reference-tile")).toHaveCount(4);
  await expect(field.getByRole("button", { name: "添加详情图", exact: true })).toBeVisible();
  await field.getByRole("button", { name: "清除详情图", exact: true }).click();
  await expect(field.locator(".reference-tile")).toHaveCount(0);
  await expect(field.getByRole("button", { name: "清除详情图", exact: true })).toHaveCount(0);
});

test("view picker locks background scrolling while its own content remains scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/commerce/textile-set");
  const composer = page.locator(".composer-scroll");
  const opener = page.getByRole("button", { name: "选择裂变类型", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "裂变类型", exact: true });
  await expect(dialog).toBeVisible();
  await expect(composer).toHaveCSS("overflow-y", "hidden");
  const before = await composer.evaluate((element) => element.scrollTop);
  const panel = await composer.boundingBox();
  if (!panel) throw new Error("Composer missing");
  await page.mouse.move(panel.x + panel.width / 2, panel.y + 40);
  await page.mouse.wheel(0, 500);
  await expect(dialog).toBeVisible();
  await expect.poll(() => composer.evaluate((element) => element.scrollTop)).toBe(before);
  const body = dialog.locator(".textile-views-body");
  await body.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "关闭裂变类型", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(composer).toHaveCSS("overflow-y", "auto");
  await expect.poll(() => composer.evaluate((element) => element.scrollTop)).toBe(before);
});
