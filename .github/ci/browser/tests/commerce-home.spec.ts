import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

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
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "product.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  // 主图制作沿用改版前的参考图条：描述上方只有一个添加小格，没有“商品图／参考图”两行入口。
  const referencesBox = await page.locator(".home-references").boundingBox();
  const promptBox = await page.getByRole("textbox", { name: "创作需求" }).boundingBox();
  expect(referencesBox && promptBox && referencesBox.y + referencesBox.height <= promptBox.y).toBe(
    true,
  );
  await expect(page.getByRole("button", { name: /^(商品图|参考图)$/ })).toHaveCount(0);
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
  await panel.getByRole("button", { name: /Image 2\.5/ }).click();
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
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
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

test("home inspiration filters examples and replaces the prompt without submitting paid work", async ({
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
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(10);
  await page.getByRole("textbox", { name: "创作需求" }).fill("我的原提示词");
  await gallery.getByRole("tab", { name: "家纺展示", exact: true }).click();
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(6);
  await gallery.getByRole("button", { name: "查看灵感：枕间细节", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "灵感详情：枕间细节", exact: true });
  await expect(detail.getByText("家纺展示", { exact: true })).toBeVisible();
  await expect(detail.getByText("示例素材", { exact: false })).toHaveCount(0);
  const heading = await detail.getByRole("heading", { name: "枕间细节" }).boundingBox();
  const close = await detail
    .getByRole("button", { name: "关闭灵感详情", exact: true })
    .boundingBox();
  if (!heading || !close) throw new Error("Missing inspiration detail header");
  expect(close.x).toBeGreaterThan(heading.x + heading.width);
  expect(close.y).toBeLessThan(heading.y + heading.height);
  await detail.getByRole("button", { name: "做同款", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
    /基于参考床品拍摄枕头特写/,
  );
  expect(submissions).toBe(0);
});

test("inspiration loads another batch when the bottom reaches the viewport", async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/inspiration");
  const gallery = page.getByRole("region", { name: "灵感库", exact: true });
  const cards = gallery.locator(".home-inspiration-card");
  const sentinel = gallery.locator(".infinite-load");
  const firstCard = gallery.getByRole("button", { name: "查看灵感：水光香氛", exact: true });
  const firstCardPosition = () =>
    firstCard.evaluate((card) => {
      const grid = card.closest(".home-inspiration-grid");
      if (!grid) throw new Error("Missing inspiration grid");
      const frame = grid.getBoundingClientRect();
      const tile = card.getBoundingClientRect();
      return { x: tile.x - frame.x, y: tile.y - frame.y };
    });

  await expect(cards).toHaveCount(12);
  const originalPosition = await firstCardPosition();
  for (const count of [18, 23]) {
    await sentinel.scrollIntoViewIfNeeded();
    await expect(cards).toHaveCount(count);
  }
  expect(await firstCardPosition()).toEqual(originalPosition);
  await expect(sentinel).toHaveCount(0);
});

test("homepage Inspiration opens the matching public header with a fixed wordmark", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const header = page.locator(".public-site-header");
  const logo = header.locator(".public-site-brand");
  const wordmark = logo.locator(".public-site-wordmark");
  const actions = header.locator(".public-site-actions");
  await expect(header.getByRole("link", { name: "开始创作", exact: true })).toBeVisible();
  const logoOnHome = await logo.boundingBox();
  const wordmarkOnHome = await wordmark.boundingBox();
  const actionsOnHome = await actions.boundingBox();
  await header.getByRole("link", { name: "灵感库", exact: true }).click();
  await expect(page).toHaveURL(/\/inspiration$/);
  await expect(page.getByRole("heading", { name: "灵感库", level: 1 })).toHaveClass("sr-only");
  expect(await logo.boundingBox()).toEqual(logoOnHome);
  expect(await actions.boundingBox()).toEqual(actionsOnHome);
  await expect(header.getByRole("link", { name: "灵感库", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(header.getByRole("link", { name: "开始创作", exact: true })).toHaveAttribute(
    "href",
    /\/dashboard$/,
  );
  await expect(wordmark).toHaveCSS("opacity", "1");
  expect(await wordmark.boundingBox()).toEqual(wordmarkOnHome);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  expect(await wordmark.boundingBox()).toEqual(wordmarkOnHome);
  await expect(header.locator(".public-site-symbol")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".home-inspiration-column")).toHaveCount(6);
  await expect(page.getByText("挑一张喜欢的画面")).toHaveCount(0);
  await expect(page.getByText("AI 生成的示例")).toHaveCount(0);
  const tabs = page.getByRole("tablist", { name: "灵感分类" });
  const pill = tabs.locator(".selection-pill");
  await expect(pill).toHaveCSS("visibility", "visible");
  const startingClip = await pill.evaluate((element) => getComputedStyle(element).clipPath);
  const creative = tabs.getByRole("tab", { name: "创意视觉" });
  await creative.click();
  await expect(creative).toHaveAttribute("aria-selected", "true");
  await expect(pill).not.toHaveCSS("clip-path", startingClip);
});

for (const width of [390, 1440]) {
  test(`the wordmark stays aligned when opening Main Image at ${width}px`, async ({ page }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const wordmark = page.locator(".public-site-wordmark");
    await expect(wordmark).toBeVisible();
    const homePosition = await wordmark.boundingBox();
    if (width === 390) {
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
      const menu = page.locator(".public-site-mobile-nav");
      await menu.getByRole("button", { name: "商品图片", exact: true }).click();
      await menu.getByRole("link", { name: "商品主图", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "商品图片", exact: true }).click();
      await page.getByRole("menuitem", { name: "商品主图", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/dashboard\/commerce\/create$/);
    const workspaceWordmark = page.locator(".workspace-site-brand > img");
    await expect(workspaceWordmark).toBeVisible();
    expect(await workspaceWordmark.boundingBox()).toEqual(homePosition);
  });
}

test("inspiration library cards offer 做同款 by hover or keyboard without submitting paid work", async ({
  page,
}) => {
  await mockImageApi(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      submissions++;
  });
  await page.goto("/inspiration");
  const gallery = page.getByRole("region", { name: "灵感库", exact: true });
  const tileOf = (title: string) =>
    gallery.locator(".home-inspiration-tile").filter({
      has: page.getByRole("button", { name: `查看灵感：${title}`, exact: true }),
    });
  const card = gallery.getByRole("button", { name: "查看灵感：水光香氛", exact: true });
  const tile = tileOf("水光香氛");
  const panel = tile.locator(".home-inspiration-panel");
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  // 先把卡片滚到靠上的位置再直接移动鼠标，避免 Playwright 的 hover 自行滚动页面、让卡片停在视口底边。
  const centerOf = async (target: typeof tile) => {
    const box = await target.boundingBox();
    if (!box) throw new Error("Missing inspiration target");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const hoverNearTop = async (target: typeof tile) => {
    await target.evaluate((element) =>
      window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 120),
    );
    const center = await centerOf(target);
    await page.mouse.move(center.x, center.y);
  };
  // 卡片悬停时有 200ms 的上移与放大，等目标淡入完成（动画同时结束）再按它的中心点击。
  const clickCenter = async (target: typeof tile) => {
    await expect(target).toHaveCSS("opacity", "1");
    const center = await centerOf(target);
    await page.mouse.click(center.x, center.y);
  };
  await hoverNearTop(tile);
  await page.mouse.move(0, 0);
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(panel).toHaveCSS("opacity", "0");

  // 玻璃面板在卡片内、属于卡片按钮：点面板打开这张卡的详情。
  await hoverNearTop(tile);
  await expect(panel).toHaveCSS("opacity", "1");
  await clickCenter(panel);
  const detail = page.getByRole("dialog", { name: "灵感详情：水光香氛", exact: true });
  await expect(detail).toBeVisible();
  const insets = await detail.evaluate((dialog) => {
    const title = dialog.querySelector(".modal__heading");
    const photo = dialog.querySelector(".home-inspiration-detail-content > img");
    if (!title || !photo) throw new Error("Missing inspiration detail content");
    const frame = dialog.getBoundingClientRect();
    return {
      top: title.getBoundingClientRect().top - frame.top,
      bottom: frame.bottom - photo.getBoundingClientRect().bottom,
    };
  });
  expect(insets.top).toBeCloseTo(insets.bottom);
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
  const other = tileOf("玻璃花的想象");
  await hoverNearTop(other);
  const makeOther = gallery.getByRole("button", { name: "做同款：玻璃花的想象", exact: true });
  await clickCenter(makeOther);
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(prompt).not.toHaveValue(/将商品放在水边石台上/);
  expect(submissions).toBe(0);
});

test("inspiration search expands in place and Escape resets results and focus", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/inspiration");
  const search = page.getByRole("button", { name: "搜索灵感", exact: true });
  const cards = page.locator(".home-inspiration-card");
  await search.click();
  const field = page.getByRole("searchbox", { name: "搜索灵感", exact: true });
  await expect(field).toBeFocused();
  await expect(field).toHaveCSS("border-top-width", "0px");
  await field.fill("俯拍整床");
  await expect(cards).toHaveCount(1);
  await expect(cards.locator(".home-inspiration-tag")).toHaveCount(0);
  await field.fill("no-existing-work-123");
  const empty = page.locator(".home-inspiration-no-results");
  await expect(empty.locator(".ui-icon")).toBeVisible();
  await expect(empty.getByRole("status")).toHaveText(
    "未找到匹配的灵感，试试其他关键词或切换分类。",
  );
  await field.press("Escape");
  await expect(search).toBeFocused();
  await expect(cards).toHaveCount(12);
});

test("inspiration filters stay fixed below the header while browsing", async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/inspiration");
  const scrollbar = page.locator("body > .lycobo-page-scrollbar");
  await expect(scrollbar).toHaveCSS("position", "fixed");
  await expect(page.locator("html")).toHaveCSS("scrollbar-width", "none");
  const toolbar = page.locator(".home-inspiration-bar");
  await expect(toolbar).toBeInViewport();
  await expect(toolbar).toHaveCSS("padding-bottom", "12px");
  const grid = page.locator(".home-inspiration-grid");
  await expect(grid).toBeInViewport();
  const before = await toolbar.boundingBox();
  const gridAtRest = await grid.boundingBox();
  if (!before || !gridAtRest) throw new Error("Missing inspiration toolbar or grid");
  expect(gridAtRest.y).toBeCloseTo(before.y + before.height);
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 450);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(toolbar).toBeInViewport();
  expect(await toolbar.boundingBox()).toEqual(before);
  await expect
    .poll(() => scrollbar.evaluate((rail) => Math.abs(rail.scrollTop - window.scrollY)))
    .toBeLessThanOrEqual(1);
  expect(
    await toolbar.evaluate((element, x) => {
      const { bottom } = element.getBoundingClientRect();
      return document.elementFromPoint(x, bottom - 6) === element;
    }, gridAtRest.x + 8),
  ).toBe(true);
  await expect(page.getByRole("search", { name: "搜索灵感" })).toBeInViewport();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("searchbox", { name: "搜索灵感", exact: true })).toBeFocused();
});

test.describe("touch inspiration library", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("taps open the detail because touch has no hover panel", async ({ page }) => {
    await mockImageApi(page);
    await page.goto("/inspiration");
    const gallery = page.getByRole("region", { name: "灵感库", exact: true });
    const card = gallery.getByRole("button", { name: "查看灵感：水光香氛", exact: true });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(gallery.getByRole("button", { name: /^做同款：/ })).toHaveCount(0);
    await card.tap();
    const detail = page.getByRole("dialog", { name: "灵感详情：水光香氛", exact: true });
    await expect(detail.getByRole("button", { name: "做同款", exact: true })).toBeVisible();
  });
});

test("wide home inspiration fills every column and clears the left dock", async ({ page }) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 2400, height: 1100 });
  await page.goto("/");
  const gallery = page.getByRole("region", { name: "创作灵感", exact: true });
  // 瀑布流首屏先放 10 张，滚动后再加载。
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(10);
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
      gridLeft: bounds.left,
      rightGutter: outer.right - bounds.right,
      lastCardRight: Math.max(...cards.map((card) => card.right)),
      gridRight: bounds.right,
      columns: new Set(cards.map((card) => Math.round(card.left))).size,
    };
  });
  // 与 vidmuse 一样，作品墙左侧为悬浮入口让位，右侧留白 60px。
  const dock = await page.locator(".home-dock").boundingBox();
  expect(layout.gridLeft).toBeGreaterThanOrEqual((dock?.x ?? 0) + (dock?.width ?? 0) + 16);
  expect(Math.abs(layout.rightGutter - 60)).toBeLessThan(1);
  expect(Math.abs(layout.lastCardRight - layout.gridRight)).toBeLessThan(1);
  expect(layout.columns).toBe(5);
  await gallery.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/lycobo-inspiration-wide.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(gallery.locator(".home-inspiration-column")).toHaveCount(2);
  // 前面滚动时可能已加载过一批，这里只要求首屏的 10 张都还在。
  await expect
    .poll(() => gallery.locator(".home-inspiration-card").count())
    .toBeGreaterThanOrEqual(10);
  await gallery.getByRole("tab", { name: "家纺展示", exact: true }).click();
  await expect(gallery.locator(".home-inspiration-card")).toHaveCount(6);
});

test("templates fill the prompt in place, confirm replacement and never submit paid work", async ({
  page,
}) => {
  await mockImageApi(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      submissions++;
  });
  await page.goto("/");
  const templates = page.getByRole("region", { name: "创作用途", exact: true });
  await expect(templates.getByRole("button")).toHaveCount(5);
  const prompt = page.getByRole("textbox", { name: "创作需求" });
  await templates.getByRole("button", { name: "白底主图", exact: true }).click();
  await expect(prompt).toHaveValue(/纯白背景/);
  await prompt.fill("保留我的商品描述");
  await templates.getByRole("button", { name: "场景主图", exact: true }).click();
  await page.getByRole("button", { name: "保留当前内容", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的商品描述");
  await templates.getByRole("button", { name: "场景主图", exact: true }).click();
  await page.getByRole("button", { name: "替换", exact: true }).click();
  await expect(prompt).toHaveValue(/真实自然的使用场景/);
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  expect(submissions).toBe(0);
});

test("home modes keep each tool's draft and hand off to the matching workspace tool", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/");
  const modes = page.getByRole("tablist", { name: "创作模式" });
  const prompt = page.getByRole("textbox", { name: "创作需求" });
  await prompt.fill("主图描述");
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles("apps/web/public/studio/bedroom-thumb.webp");
  await expect(page.locator(".reference-tile")).toHaveCount(1);

  await modes.getByRole("tab", { name: "视频创作" }).click();
  await expect(page).toHaveURL(/\?mode=video$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("动起来讲卖点");
  await expect(prompt).toHaveValue("");
  // 切换模式只向空图片槽带入商品图，与工作区工具坞一致。
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await prompt.fill("镜头推近展示面料");

  await modes.getByRole("tab", { name: "主图制作" }).click();
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  await expect(prompt).toHaveValue("主图描述");
  await modes.getByRole("tab", { name: "视频创作" }).click();
  await expect(prompt).toHaveValue("镜头推近展示面料");
  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  await expect(page).toHaveURL(/\/video$/);
  await expect(page.getByLabel("场景描述", { exact: true })).toHaveValue("镜头推近展示面料");
});

test("textile mode selects views and opens the textile tool with the uploaded main image", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/?mode=textile");
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveCount(0);
  // 只有家纺裂变保留左侧“家纺主图／详情图”两行上传入口。
  await expect(page.getByRole("button", { name: "详情图", exact: true })).toBeVisible();
  const start = page.getByRole("button", { name: "开始创作", exact: true });
  await expect(start).toBeDisabled();
  const views = page.getByRole("toolbar", { name: "裂变视角" });
  await views.getByRole("button", { name: "正面", exact: true }).click();
  await expect(views.getByRole("button", { name: "正面", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles([
      "apps/web/public/studio/bedroom-thumb.webp",
      "apps/web/public/studio/textile-views/fabric.webp",
    ]);
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(page.locator(".textile-selected-name", { hasText: "正面" })).toBeVisible();
  await expect(page.locator(".reference-image-card")).toHaveCount(2);
});

for (const width of [1440, 390]) {
  test(`header switches to a light surface without shifting controls at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const header = page.locator(".public-site-header");
    const frame = page.frameLocator("iframe.openart-reference");
    const scroll = (top: number) =>
      frame.locator("html").evaluate((element, scrollY) => {
        element.ownerDocument.defaultView?.scrollTo(0, scrollY);
      }, top);
    const surface = () =>
      header.evaluate((element) => {
        const style = getComputedStyle(element, "::before");
        return { background: style.backgroundColor, blur: style.backdropFilter };
      });
    const height = () => header.evaluate((element) => element.getBoundingClientRect().height);
    const brand = page.locator(".public-site-brand");
    const brandTop = () =>
      brand.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
    await expect(brand).toBeVisible();
    await expect(header).not.toHaveAttribute("data-scrolled");
    expect(await surface()).toEqual({ background: "rgba(0, 0, 0, 0)", blur: "none" });
    expect(await height()).toBe(60);
    const top = await brandTop();
    // 商品画面随滚动变化，但共用顶栏的位置保持稳定。
    await scroll(400);
    await expect(header).toHaveAttribute("data-scrolled", "true");
    await expect.poll(surface).toEqual({
      background: "rgb(250, 250, 250)",
      blur: "none",
    });
    expect(await height()).toBe(60);
    expect(await brandTop()).toBe(top);
    expect(await header.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
    await page.screenshot({ path: `/tmp/lycobo-home-header-surface-${width}.png` });
    await scroll(0);
    await expect(header).not.toHaveAttribute("data-scrolled");
    await expect.poll(surface).toEqual({ background: "rgba(0, 0, 0, 0)", blur: "none" });
  });
}

test("home uses Lycobo's own brand language instead of copying the reference look", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/");
  // 标语正体，关键词用当前模式的强调渐变；模式页签选中底色跟随工具强调色。
  await expect(page.locator(".home-slogan")).toHaveCSS("font-style", "normal");
  const highlight = page.locator(".home-slogan-highlight");
  await expect(highlight).toHaveText("好主图");
  await expect(highlight).toHaveCSS("background-image", /linear-gradient/);
  const selection = page.locator(".home-modes .toggle-selection");
  await expect(selection).toHaveCSS("background-color", "rgb(168, 255, 0)");
  // 开始创作是青柠→薄荷渐变胶囊；描述框用本站占位文字。
  await expect(page.locator(".home-submit")).toHaveCSS("background-image", /linear-gradient/);
  await expect(page.getByRole("textbox", { name: "创作需求", exact: true })).toHaveAttribute(
    "placeholder",
    "描述你想要的画面，输入 @ 引用已上传图片",
  );
  await expect(page.locator(".home-prompt-hint")).toHaveCount(0);
  await page.getByRole("tab", { name: "家纺裂变" }).click();
  await expect(highlight).toHaveText("整套视角");
  await expect
    .poll(() => selection.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(255, 178, 122)");
  // 顶部栏头像是正圆。
  const avatar = page.locator(".topbar .account-avatar");
  await expect(avatar).toHaveCSS("border-top-left-radius", "50%");
  await expect(avatar.locator(".avatar__fallback")).toHaveCSS("border-top-left-radius", "50%");
});

test("home footer links only to real pages", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  const footer = page.frameLocator("iframe.openart-reference").locator(".site-footer");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.getByRole("navigation")).toBeVisible();
  const links = footer.getByRole("link");
  await expect(links).toHaveText(["用户协议", "隐私政策", "退款政策", "suport@lycobo.com"]);
  await expect(footer.getByRole("link", { name: "退款政策", exact: true })).toHaveAttribute(
    "href",
    "https://bonko.fun/refund-policy",
  );
  await expect(footer.getByRole("img", { name: "Lycobo", exact: true })).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "suport@lycobo.com", exact: true }),
  ).toHaveAttribute("href", "mailto:suport@lycobo.com");
  await expect(footer).toContainText(`© ${new Date().getFullYear()} Lycobo`);
  await footer.getByRole("link", { name: "用户协议", exact: true }).click();
  await expect(page).toHaveURL(/\/zh-CN\/terms$/);
});

test("phones get the vidmuse bottom bar with labelled shortcuts", async ({ page }) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dock = page.getByRole("navigation", { name: "快捷入口", exact: true });
  const box = await dock.boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width).toBe(390);
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
  await expect(dock.getByRole("link")).toHaveText(["首页", "工作区"]);
  await expect(dock.getByRole("button", { name: "素材库", exact: true })).toBeVisible();
  await expect(dock.getByRole("link", { name: "首页", exact: true })).toHaveClass(/active/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(dock.getByRole("link", { name: "首页", exact: true })).toBeHidden();
  await expect(dock.locator(".home-dock-label").first()).toBeHidden();
  // 素材库入口直接打开弹窗，不跳转页面；关闭后焦点回到入口。
  const entry = dock.getByRole("button", { name: "素材库", exact: true });
  await entry.click();
  const library = page.getByRole("dialog", { name: "素材库", exact: true });
  await expect(library).toBeVisible();
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  await page.keyboard.press("Escape");
  await expect(library).toHaveCount(0);
  await expect(entry).toBeFocused();
});

for (const width of [1440, 390]) {
  test(`home atmosphere sits behind the header and follows the selected mode at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const atmosphere = page.locator(".home-atmosphere");
    await expect(atmosphere).toHaveAttribute("aria-hidden", "true");
    const bounds = await atmosphere.boundingBox();
    expect(bounds?.y).toBe(0);
    expect(bounds?.width).toBe(width);
    await expect(page.locator(".grid-motion, .home-motion-background")).toHaveCount(0);
    // 首屏背景是丝绸 WebGL 画布：纯装饰、不接收指针。有 GPU 加速时画布上下文在切换页签后依然有效；
    // 无头浏览器用软件渲染，这时不启用丝绸，只留静态渐变。
    const silk = atmosphere.locator(".silk-background");
    await expect(silk).toHaveAttribute("aria-hidden", "true");
    await expect(silk).toHaveCSS("pointer-events", "none");
    const canvas = silk.locator("canvas");
    const contextAlive = async () => {
      if ((await canvas.count()) === 0) return true;
      return canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) return false;
        const gl = element.getContext("webgl2");
        return gl !== null && !gl.isContextLost();
      });
    };
    expect(await canvas.count()).toBeLessThanOrEqual(1);
    expect(await contextAlive()).toBe(true);
    const prompt = page.getByRole("textbox", { name: "创作需求", exact: true });
    await prompt.fill("保留商品的颜色与材质");
    const modes = page.getByRole("tablist", { name: "创作模式" });
    await modes.getByRole("tab", { name: "套图计划" }).click();
    await expect(page.locator(".commerce-home")).toHaveAttribute("data-mode", "variation");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("先规划再生成");
    await modes.getByRole("tab", { name: "主图制作" }).click();
    await expect(page.locator(".commerce-home")).toHaveAttribute("data-mode", "create");
    await expect(prompt).toHaveValue("保留商品的颜色与材质");
    expect(await canvas.count()).toBeLessThanOrEqual(1);
    expect(await contextAlive()).toBe(true);
    await page.screenshot({ path: `/tmp/lycobo-home-modes-${width}.png` });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}
