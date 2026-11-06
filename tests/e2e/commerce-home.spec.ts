import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("home composer shares prompt and real reference drafts without submitting generation", async ({
  page,
}) => {
  await mockImageApi(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      submissions += 1;
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "创作需求" }).fill("为我的商品搭配自然光场景");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "product.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  const uploadBox = await page.locator(".home-upload").boundingBox();
  const promptBox = await page.getByRole("textbox", { name: "创作需求" }).boundingBox();
  expect(uploadBox && promptBox && uploadBox.y + uploadBox.height <= promptBox.y).toBe(true);
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles([
      "apps/web/public/studio/commerce-atlas.webp",
      "apps/web/public/studio/bedroom.webp",
      "apps/web/public/studio/lavender.webp",
      "apps/web/public/studio/set.webp",
    ]);
  await expect(page.locator(".reference-tile")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toHaveCount(0);
  for (let number = 5; number > 1; number -= 1) {
    await page
      .locator(".reference-tile")
      .nth(number - 1)
      .hover();
    await page.getByRole("button", { name: `移除参考图：图片${number}`, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
    "为我的商品搭配自然光场景",
  );
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  expect(submissions).toBe(0);
});

for (const width of [320, 390, 768, 1440, 1920]) {
  test(`home remains operable at ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "创作需求" })).toBeVisible();
    await expect(page.getByRole("region", { name: "创作用途" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width === 390 || width === 1920)
      await page.screenshot({ path: `/tmp/lycobo-home-${width}.png`, fullPage: true });
  });
}

test("home settings preserve drafts and only image creation is offered", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  await page.getByRole("textbox", { name: "创作需求" }).fill("保留绗缝与面料细节");
  await page.getByRole("button", { name: "选择创作模型", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "模型和画面设置" });
  await expect(panel).toBeVisible();
  await panel.getByRole("radio", { name: "16:9", exact: true }).click();
  await panel.getByRole("button", { name: /Image 2.5/ }).click();
  await panel.press("Escape");
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("保留绗缝与面料细节");
  await expect(page.getByRole("button", { name: "选择创作模型", exact: true })).toContainText(
    "16:9",
  );
  await expect(page.getByRole("radio", { name: "商品视频" })).toHaveCount(0);
  await expect(page.getByText("视频生成即将开放", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
    "保留绗缝与面料细节",
  );
});

test("ratio pager moves one page and keeps the selection", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "选择创作模型" }).click();
  const panel = page.getByRole("dialog", { name: "模型和画面设置" });
  const track = panel.locator(".home-ratio-track");
  await expect(panel.getByRole("button", { name: "上一页画面比例" })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "下一页画面比例" })).toBeVisible();
  await panel.getByRole("button", { name: "下一页画面比例" }).click();
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(panel.getByRole("button", { name: "上一页画面比例" })).toBeVisible();
  await panel.getByRole("radio", { name: "3:4", exact: true }).click();
  await expect(page.getByRole("button", { name: "选择创作模型" })).toContainText("3:4");
});

test("home model settings can change resolution and count with animated selection", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "选择创作模型" }).click();
  const panel = page.getByRole("dialog", { name: "模型和画面设置" });
  await panel.getByRole("button", { name: /Banana 2.1/ }).click();
  const resolution = panel.getByRole("radio", { name: "2K", exact: true });
  await expect(resolution).toBeEnabled();
  await resolution.click();
  await expect(resolution).toHaveAttribute("data-selected", "true");
  await expect(panel.locator(".toggle-selection")).toHaveCount(4);
  await panel.getByRole("radio", { name: "3 张", exact: true }).click();
  await expect(page.getByRole("button", { name: "选择创作模型" })).toContainText("2K");
});

test("reopening model settings restores the selected ratio page", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "选择创作模型" });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "模型和画面设置" });
  const track = panel.locator(".home-ratio-track");
  await panel.getByRole("button", { name: "下一页画面比例" }).click();
  await panel.getByRole("radio", { name: "21:9", exact: true }).click();
  await page.keyboard.press("Escape");
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(panel.getByRole("radio", { name: "21:9", exact: true })).toBeInViewport();
  await expect(panel.getByRole("button", { name: "上一页画面比例" })).toBeVisible();
});

test("duplicate reference uploads are filtered and announced", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const file = { name: "same.png", mimeType: "image/png", buffer: png };
  await page.getByLabel("添加参考图片", { exact: true }).setInputFiles([file, file]);
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await expect(page.getByText("存在相同素材，已自动过滤")).toBeVisible();
});

test("removing a referenced image deletes its mention and renumbers later mentions", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/");
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles([
      "apps/web/public/studio/commerce-atlas.webp",
      "apps/web/public/studio/bedroom-thumb.webp",
    ]);
  const prompt = page.getByRole("textbox", { name: "创作需求" });
  await prompt.fill("保留 @图片1 和 @图片2 的画面");
  await expect(prompt.locator(".reference-prompt-chip")).toHaveCount(2);

  await page.locator(".reference-tile").first().hover();
  await page.getByRole("button", { name: "移除参考图：图片1", exact: true }).click();
  await expect(prompt.locator(".reference-prompt-chip")).toHaveCount(1);
  await expect(prompt.locator(".reference-prompt-chip")).toHaveAttribute(
    "data-reference",
    "@图片1",
  );
  await expect(prompt).not.toContainText("@图片2");

  await page.locator(".reference-tile").first().hover();
  await page.getByRole("button", { name: "移除参考图：图片1", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("保留 和 的画面");
});

test("image mentions insert at the cursor and preserve surrounding text", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  const prompt = page.getByRole("textbox", { name: "创作需求" });
  await prompt.fill("@");
  const menu = page.getByRole("dialog", { name: "引用图片" });
  await expect(menu).toContainText("暂无匹配图片");
  await menu.press("Escape");
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles([
      "apps/web/public/studio/commerce-atlas.webp",
      "apps/web/public/studio/bedroom-thumb.webp",
    ]);
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await prompt.fill("保留 面料");
  await prompt.press("Home");
  await prompt.press("ArrowRight");
  await prompt.press("ArrowRight");
  await prompt.press("@");
  await expect(menu).toBeVisible();
  await page.getByRole("option", { name: "bedroom-thumb.webp", exact: true }).click();
  await expect(prompt).toBeFocused();
  await expect(prompt).toHaveText("保留图片2  面料");
  await expect(prompt.locator("[data-reference]")).toHaveAttribute("data-reference", "@图片2");
  await prompt.pressSequentially("继续编辑");
  await expect(prompt).toHaveText("保留图片2 继续编辑 面料");
  await expect(prompt).toBeFocused();
  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  const workspacePrompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await expect(workspacePrompt).toHaveText("保留图片2 继续编辑 面料");
  await workspacePrompt.fill("@");
  await expect(menu).toBeVisible();
  await menu.getByRole("textbox", { name: "搜索图片" }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("option", { name: "commerce-atlas.webp", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(workspacePrompt).toHaveText("图片1 ");
});

test("home inspiration filters examples and confirms prompt replacement without submitting paid work", async ({
  page,
}) => {
  await mockImageApi(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      submissions++;
  });
  await page.goto("/");
  const gallery = page.getByRole("region", { name: "创作灵感", exact: true });
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(13);
  await page.getByRole("textbox", { name: "创作需求" }).fill("我的原提示词");
  await gallery.getByRole("tab", { name: "家纺展示", exact: true }).click();
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(4);
  await gallery.getByRole("button", { name: "查看灵感：枕间细节", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "灵感详情：枕间细节", exact: true });
  await expect(detail.getByText("家纺展示 · 示例素材")).toBeVisible();
  const heading = await detail.getByRole("heading", { name: "枕间细节" }).boundingBox();
  const close = await detail
    .getByRole("button", { name: "关闭灵感详情", exact: true })
    .boundingBox();
  if (!heading || !close) throw new Error("Missing inspiration detail header");
  expect(close.x).toBeGreaterThan(heading.x + heading.width);
  expect(close.y).toBeLessThan(heading.y + heading.height);
  await detail.getByRole("button", { name: "做同款", exact: true }).click();
  await page.getByRole("button", { name: "保留当前内容", exact: true }).click();
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "做同款", exact: true }).click();
  await page.getByRole("button", { name: "替换并进入", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
    /基于参考床品拍摄枕头特写/,
  );
  expect(submissions).toBe(0);
});

test("home inspiration cards offer 做同款 by hover or keyboard without submitting paid work", async ({
  page,
}) => {
  await mockImageApi(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      submissions++;
  });
  await page.goto("/");
  const gallery = page.getByRole("region", { name: "创作灵感", exact: true });
  const tileOf = (title: string) =>
    gallery.locator(".home-inspiration-tile").filter({
      has: page.getByRole("button", { name: `查看灵感：${title}`, exact: true }),
    });
  const card = gallery.getByRole("button", { name: "查看灵感：水光香氛", exact: true });
  const tile = tileOf("水光香氛");
  const panel = tile.locator(".home-inspiration-panel");
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(panel).toHaveCSS("opacity", "0");

  // Only 做同款 takes the pointer: the rest of the panel still opens the detail.
  await tile.hover();
  await expect(panel).toHaveCSS("opacity", "1");
  await panel.locator("strong").click({ force: true });
  const detail = page.getByRole("dialog", { name: "灵感详情：水光香氛", exact: true });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "关闭灵感详情", exact: true }).click();
  await expect(detail).toBeHidden();

  await page.mouse.move(0, 0);
  await card.focus();
  await page.keyboard.press("Tab");
  await expect(
    gallery.getByRole("button", { name: "做同款：水光香氛", exact: true }),
  ).toBeFocused();
  await expect(panel).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(prompt).toHaveValue(/将商品放在水边石台上/);

  await page.goBack();
  const other = tileOf("原木与晨光");
  await other.scrollIntoViewIfNeeded();
  await other.hover();
  const makeOther = gallery.getByRole("button", { name: "做同款：原木与晨光", exact: true });
  await makeOther.click();
  await page.getByRole("button", { name: "保留当前内容", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await makeOther.click();
  await page.getByRole("button", { name: "替换并进入", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(prompt).not.toHaveValue(/将商品放在水边石台上/);
  expect(submissions).toBe(0);
});

test.describe("touch home inspiration", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("taps open the detail because touch has no hover panel", async ({ page }) => {
    await mockImageApi(page);
    await page.goto("/");
    const gallery = page.getByRole("region", { name: "创作灵感", exact: true });
    const card = gallery.getByRole("button", { name: "查看灵感：水光香氛", exact: true });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(gallery.getByRole("button", { name: /^做同款：/ })).toHaveCount(0);
    await card.tap();
    const detail = page.getByRole("dialog", { name: "灵感详情：水光香氛", exact: true });
    await expect(detail.getByRole("button", { name: "做同款", exact: true })).toBeVisible();
  });
});

test("wide home inspiration fills every column with equal side gutters", async ({ page }) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 2400, height: 1100 });
  await page.goto("/");
  const gallery = page.getByRole("region", { name: "创作灵感", exact: true });
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(13);
  await expect(gallery.getByText("示例素材 · 找到下一张商品图的方向")).toHaveCount(0);
  const layout = await gallery.evaluate((element) => {
    const home = element.closest(".commerce-home");
    const grid = element.querySelector(".home-inspiration-grid");
    if (!home || !grid) throw new Error("Missing inspiration layout");
    const outer = home.getBoundingClientRect();
    const bounds = grid.getBoundingClientRect();
    const cards = Array.from(grid.querySelectorAll(".home-inspiration-card")).map((card) =>
      card.getBoundingClientRect(),
    );
    return {
      leftGutter: bounds.left - outer.left,
      rightGutter: outer.right - bounds.right,
      lastCardRight: Math.max(...cards.map((card) => card.right)),
      gridRight: bounds.right,
      columns: new Set(cards.map((card) => Math.round(card.left))).size,
    };
  });
  expect(Math.abs(layout.leftGutter - layout.rightGutter)).toBeLessThan(1);
  expect(Math.abs(layout.lastCardRight - layout.gridRight)).toBeLessThan(1);
  expect(layout.columns).toBe(5);
  await gallery.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/lycobo-inspiration-wide.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(gallery.locator(".home-inspiration-column")).toHaveCount(2);
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(13);
  await gallery.getByRole("tab", { name: "家纺展示", exact: true }).click();
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(4);
});

test("image shortcuts preserve the current draft and never submit paid work", async ({ page }) => {
  await mockImageApi(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      submissions++;
  });
  await page.goto("/");
  const shortcuts = page.getByRole("region", { name: "创作用途", exact: true });
  await expect(shortcuts.getByRole("button")).toHaveCount(4);
  await page.getByRole("textbox", { name: "创作需求" }).fill("保留我的商品描述");
  await shortcuts.getByRole("button", { name: "场景图", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
    "保留我的商品描述",
  );
  expect(submissions).toBe(0);
});

for (const width of [1440, 390]) {
  test(`home header matches the page background over inspiration and restores at the top at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const header = page.locator(".topbar");
    await expect(page.locator(".home-start")).toBeVisible();
    await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const initialHeight = await header.evaluate((el) => el.getBoundingClientRect().height);
    await page
      .locator(".home-inspiration")
      .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY));
    const pageBackground = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect(header).toHaveCSS("background-color", pageBackground);
    expect(await header.evaluate((el) => el.getBoundingClientRect().height)).toBe(initialHeight);
    expect(await header.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
    await page.screenshot({ path: `/tmp/lycobo-home-header-matched-${width}.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    await page.getByRole("link", { name: "工作区", exact: true }).last().click();
    await expect(page.locator(".studio-app")).toHaveAttribute("data-home-header-opaque", "false");
  });
}

for (const width of [1440, 390]) {
  test(`home moving image background leaves the composer stable at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const wall = page.locator(".grid-motion");
    await expect(wall).toHaveAttribute("data-playing", "true");
    await expect(page.locator(".home-intro, .home-intro-heading")).toHaveCount(0);
    await expect(page.locator(".grid-motion__row")).toHaveCount(8);
    const background = page.locator(".home-motion-background");
    const backgroundBounds = await background.boundingBox();
    expect(backgroundBounds?.y).toBe(0);
    expect(backgroundBounds?.width).toBe(width < 768 ? width : width - 274);
    await expect(page.locator(".home-intro-character, .home-dot-background")).toHaveCount(0);
    await expect
      .poll(() =>
        wall
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    const prompt = page.getByRole("textbox", { name: "创作需求", exact: true });
    const before = await prompt.boundingBox();
    const row = page.locator(".grid-motion__row").first();
    const transform = await row.evaluate((el) => getComputedStyle(el).transform);
    await expect
      .poll(() => row.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(transform);
    await prompt.fill("保留商品的颜色与材质");
    expect((await prompt.boundingBox())?.y).toBe(before?.y);
    await page.screenshot({ path: `/tmp/lycobo-grid-motion-home-${width}.png` });
    await wall.evaluate((el) =>
      window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY + 16),
    );
    await expect(wall).toHaveAttribute("data-playing", "false");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(wall).toHaveAttribute("data-playing", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(wall).toHaveAttribute("data-playing", "false");
    await expect(row).toHaveCSS("will-change", "auto");
    await expect(prompt).toHaveValue("保留商品的颜色与材质");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}

test("image background ignores pointer movement over the composer and credit popover", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        role: "admin",
        account: "background-pointer-fixture",
      }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".grid-motion")).toHaveAttribute("data-playing", "true");
  const maxSpot = () =>
    page
      .locator(".grid-motion__tile")
      .evaluateAll((tiles) =>
        Math.max(
          0,
          ...tiles.map((tile) =>
            Number.parseFloat(
              (tile instanceof HTMLElement ? tile.style.getPropertyValue("--spot") : "") || "0",
            ),
          ),
        ),
      );
  await page.getByRole("textbox", { name: "创作需求", exact: true }).hover();
  await expect.poll(maxSpot).toBe(0);
  await page.mouse.move(450, 90);
  await expect.poll(maxSpot).toBeGreaterThan(0.05);
  await page.getByRole("textbox", { name: "创作需求", exact: true }).hover();
  await expect.poll(maxSpot).toBe(0);
  await page.locator(".header-balance").click();
  const preview = page.getByRole("dialog", { name: "积分概览", exact: true });
  await preview.getByRole("button", { name: "充值积分", exact: true }).hover();
  await expect.poll(maxSpot).toBe(0);
  await preview.getByRole("button", { name: "全部明细" }).hover();
  await expect.poll(maxSpot).toBe(0);
  await expect(preview).toBeVisible();
});
