import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const asset = (
  publicId: string,
  overrides: { kind?: string; tool?: string | null; model?: string | null; hours?: number } = {},
  size: [number, number] = [1024, 1024],
) => ({
  id: crypto.randomUUID(),
  public_id: publicId,
  kind: overrides.kind ?? "output",
  type: "image",
  width: size[0],
  height: size[1],
  bytes: 1024,
  created_at: hoursAgo(overrides.hours ?? 0),
  task_public_id: overrides.kind === "reference" ? null : "W07AZ9T2Q",
  model: overrides.model === undefined ? "gpt-image-2.5-sunburst" : overrides.model,
  prompt: `素材 ${publicId}`,
  tool: overrides.kind === "reference" ? null : (overrides.tool ?? "create"),
});

/** Serves the asset list like the API: filters apply before pagination. */
async function mockLibrary(page: Page, assets: ReturnType<typeof asset>[]) {
  const queries: URLSearchParams[] = [];
  await mockImageApi(page);
  await page.route("**/api/v1/image-model-logos", (route) =>
    route.fulfill({
      json: apiFixture({
        models: [
          { id: "gpt-image-2", name: "Image 2", logoUrl: null },
          { id: "gpt-image-2.5", name: "Image 2.5", logoUrl: null },
        ],
      }),
    }),
  );
  const favorites = new Set<string>();
  await page.route("**/api/v1/image-asset-favorites", (route) =>
    route.fulfill({ json: apiFixture({ data: [...favorites] }) }),
  );
  await page.route("**/api/v1/image-assets/*/favorite", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    const favorite = route.request().method() === "PUT";
    if (favorite) favorites.add(id);
    else favorites.delete(id);
    return route.fulfill({ json: apiFixture({ favorite }) });
  });
  await page.route("**/api/v1/image-assets?*", (route) => {
    const query = new URL(route.request().url()).searchParams;
    queries.push(query);
    const data = assets.filter(
      (row) =>
        (!query.get("since") || row.created_at >= (query.get("since") ?? "")) &&
        (!query.get("kind") || row.kind === query.get("kind")) &&
        (!query.get("tool") || row.tool === query.get("tool")) &&
        (!query.get("type") || row.type === query.get("type")) &&
        (query.get("favorite") !== "true" || favorites.has(row.id)),
    );
    return route.fulfill({ json: apiFixture({ data }) });
  });
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  return queries;
}

/** 像下载授权接口一样返回签名链接，链接背后是原文件。 */
async function mockOriginals(page: Page) {
  const counts = { deliveries: 0, originals: 0 };
  await page.route("**/api/v1/image-assets/deliveries", (route) => {
    counts.deliveries++;
    const ids: string[] = route.request().postDataJSON().ids;
    return route.fulfill({
      json: {
        data: ids.map((id) => {
          const base = `https://assets.example.test/${id}`;
          return {
            id,
            delivery: {
              url: `${base}.preview.webp`,
              thumbnail_url: `${base}.thumbnail.webp`,
              download_url: `${base}.png?variant=download`,
              expires_at: Math.floor(Date.now() / 1000) + 300,
            },
          };
        }),
      },
    });
  });
  await page.route("https://assets.example.test/**", (route) => {
    if (route.request().resourceType() !== "image") counts.originals++;
    return route.fulfill({
      contentType: "image/png",
      body: png,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  return counts;
}

test("我的素材 opens on the current tool and filters source, time and favorites before paging", async ({
  page,
}) => {
  const textile = asset("P11111111", { tool: "textile" });
  const created = asset("P22222222", { tool: "create", hours: 30 });
  const upload = asset("P33333333", { kind: "reference", model: null, hours: 50 });
  const queries = await mockLibrary(page, [textile, created, upload]);
  await page.setViewportSize({ width: 1328, height: 906 });
  await page.goto("/commerce/textile-set");
  const entry = page.getByRole("button", { name: "打开素材库", exact: true });
  await expect(entry).toContainText("我的素材");
  // The library is lazy: browsing the workspace must not load every asset.
  expect(queries).toHaveLength(0);
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "素材库", exact: true });
  await expect(dialog.getByRole("tab", { name: "我的素材" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(dialog.getByRole("tab", { name: "灵感库" })).toBeVisible();
  // From the textile rail the source starts on 家纺裂变 and the API filters before paging.
  const tiles = dialog.locator(".asset-tile");
  await expect(tiles).toHaveCount(1);
  expect(queries.at(-1)?.get("kind")).toBe("output");
  expect(queries.at(-1)?.get("tool")).toBe("textile");
  expect(queries.at(-1)?.get("type")).toBe("image");
  expect(queries.at(-1)?.has("includeVideo")).toBe(false);
  await expect(dialog.getByRole("radio", { name: /^(图片|视频)$/ })).toHaveCount(0);
  // 全部时间是一整片瀑布流：不显示日期，也没有模型、密度和“已加载”数量。
  await expect(dialog.locator(".asset-day")).toHaveCount(0);
  await expect(dialog.getByText(/已加载/)).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: /每行/ })).toHaveCount(0);
  await expect(tiles.locator(".model-tag")).toHaveCount(0);
  const source = dialog.getByRole("button", { name: "家纺裂变 素材来源", exact: true });
  await expect(source).toHaveAttribute("data-active", "true");
  await source.click();
  // 前三项固定，后面是 AI 生成的各个功能（随工具清单变化），当前功能标“当前”。
  const options = page.getByRole("option");
  await expect(options.nth(0)).toHaveText("全部来源");
  await expect(options.nth(1)).toHaveText("我上传的");
  await expect(options.nth(2)).toHaveText("全部 AI 生成");
  await expect(page.getByRole("option", { name: "商品视频", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /家纺裂变/ })).toContainText("当前");
  await expect(page.getByRole("listbox", { name: "素材来源" })).toBeVisible();
  await page.getByRole("option", { name: "全部来源" }).click();
  await expect(tiles).toHaveCount(3);
  expect(queries.at(-1)?.has("kind")).toBe(false);
  expect(queries.at(-1)?.has("tool")).toBe(false);
  await expect(tiles.locator(".asset-tile-upload")).toHaveCount(1);
  await dialog.getByRole("button", { name: "全部来源 素材来源", exact: true }).click();
  await page.getByRole("option", { name: "我上传的" }).click();
  await expect(tiles).toHaveCount(1);
  expect(queries.at(-1)?.get("kind")).toBe("reference");
  await expect(tiles.locator(".asset-tile-upload")).toHaveCount(0);
  await dialog.getByRole("button", { name: "我上传的 素材来源", exact: true }).click();
  await page.getByRole("option", { name: "全部 AI 生成" }).click();
  await expect(tiles).toHaveCount(2);
  expect(queries.at(-1)?.get("kind")).toBe("output");
  expect(queries.at(-1)?.has("tool")).toBe(false);

  // 只有选了时间范围才按天分组。
  await dialog.getByRole("button", { name: "全部时间 时间", exact: true }).click();
  await page.getByRole("option", { name: "最近 7 天", exact: true }).click();
  await expect(dialog.locator(".asset-day")).toHaveCount(2);
  expect(queries.at(-1)?.get("since")).toBeTruthy();
  await dialog.getByRole("button", { name: "最近 7 天 时间", exact: true }).click();
  await page.getByRole("option", { name: "全部时间", exact: true }).click();
  // 切回看过的筛选时直接用缓存，列表回到不分日期的一整片瀑布流。
  await expect(dialog.locator(".asset-day")).toHaveCount(0);

  const favoritesLabel = dialog.getByText("仅看收藏", { exact: true });
  await favoritesLabel.click();
  await expect(dialog.getByText("还没有收藏的素材")).toBeVisible();
  const empty = dialog.locator(".asset-empty");
  await expect(empty.locator("p")).toHaveCount(1);
  await expect(empty.locator("h2, button")).toHaveCount(0);
  const emptyBox = await empty.boundingBox();
  const iconBox = await empty.locator(".asset-empty-icon").boundingBox();
  const captionBox = await empty.locator("p").boundingBox();
  expect(emptyBox && iconBox && captionBox).toBeTruthy();
  if (emptyBox && iconBox && captionBox) {
    expect(
      Math.abs(
        (iconBox.y + captionBox.y + captionBox.height) / 2 - (emptyBox.y + emptyBox.height / 2),
      ),
    ).toBeLessThan(3);
  }
  await favoritesLabel.click();
  await expect(tiles).toHaveCount(2);

  // Favorites are saved on the server; 仅看收藏 then asks the API for them only.
  await tiles.first().hover();
  await tiles.first().getByRole("button", { name: "收藏图片", exact: true }).click();
  await expect(
    tiles.first().getByRole("button", { name: "取消收藏", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByText("仅看收藏", { exact: true }).click();
  await expect(dialog.getByRole("switch", { name: "仅看收藏" })).toBeChecked();
  await expect(tiles).toHaveCount(1);
  expect(queries.at(-1)?.get("favorite")).toBe("true");
  // Away from pointer and focus, the saved star stays in the tile corner.
  await page.mouse.move(5, 5);
  await dialog.getByRole("button", { name: "关闭素材库", exact: true }).focus();
  await expect(tiles.first().locator(".asset-tile-star")).toBeVisible();
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const edges = await page.evaluate(() => {
    const left = (selector: string) =>
      document.querySelector<HTMLElement>(selector)?.getBoundingClientRect().x ?? -1;
    return { close: left(".library-close svg"), tile: left(".asset-tile") };
  });
  expect(edges.close).toBeCloseTo(edges.tile, 0);

  await dialog.getByRole("button", { name: "关闭素材库", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
  await entry.click();
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const box = await dialog.boundingBox();
  expect([box?.x, box?.y, box?.width, box?.height].map((value) => Math.round(value ?? -1))).toEqual(
    [0, 0, 1328, 906],
  );
});

test("多选 downloads one original directly, packs several into one ZIP and leaves on Esc", async ({
  page,
}) => {
  const assets = [
    asset("P10000001"),
    asset("P10000002", { hours: 0.1 }),
    asset("P10000003", { hours: 0.2 }),
  ];
  await mockLibrary(page, assets);
  const counts = await mockOriginals(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "素材库", exact: true });
  const tiles = dialog.locator(".asset-tile");
  await expect(tiles).toHaveCount(3);
  // 悬停卡片左上的勾选圈直接进入多选，并选中这一张。
  await tiles.nth(1).hover();
  await tiles.nth(1).locator(".asset-tile-check").click();
  const bar = dialog.getByRole("toolbar", { name: "多选操作" });
  await expect(bar).toContainText("已选 1 项");
  await expect(
    dialog.getByRole("button", { name: "选择图片：素材 P10000002", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // 只选 1 项时直接下载原文件，不打包。
  const single = page.waitForEvent("download");
  await bar.getByRole("button", { name: "下载 1 项", exact: true }).click();
  const original = new URL((await single).url());
  expect(original.pathname).toBe(`/api/v1/image-assets/${assets[1]?.id}/content`);
  expect(original.searchParams.get("download")).toBe("1");
  expect(counts.deliveries).toBe(0);

  await bar.getByRole("button", { name: "全选", exact: true }).click();
  await expect(bar).toContainText("已选 3 项");
  await dialog.getByRole("button", { name: "选择图片：素材 P10000001", exact: true }).click();
  await expect(bar).toContainText("已选 2 项");
  const pending = page.waitForEvent("download");
  await bar.getByRole("button", { name: "下载 2 项", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^我的素材-\d{8}-\d{4}\.zip$/);
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  if (!path) throw new Error("Download missing");
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(bytes.includes(Buffer.from("01-P10000002.png"))).toBe(true);
  expect(bytes.includes(Buffer.from("02-P10000003.png"))).toBe(true);
  expect(counts.originals).toBe(2);
  expect(counts.deliveries).toBe(1);

  // Esc 先退出多选，再按一次才关闭素材库。
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "多选", exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("灵感库 inside the workspace library fills the prompt and closes the library", async ({
  page,
}) => {
  await mockLibrary(page, [asset("P10000001")]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "素材库", exact: true });
  const entryTabs = dialog.getByRole("tablist", { name: "素材库", exact: true });
  const underline = entryTabs.locator(".selection-pill");
  await expect(underline).toHaveCSS("visibility", "visible");
  const initialUnderline = await underline.evaluate((line) => getComputedStyle(line).clipPath);
  await dialog.getByRole("tab", { name: "灵感库" }).click();
  await expect(dialog.getByText("挑一张喜欢的画面")).toHaveCount(0);
  await expect(dialog.locator(".asset-library-head .tabs__list")).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await expect(entryTabs).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(underline).not.toHaveCSS("clip-path", initialUnderline);
  await expect(entryTabs).toHaveCSS("height", "44px");
  await expect(dialog.locator(".home-inspiration-bar .pill-tab-list")).toHaveCSS("height", "44px");
  await expect(dialog.locator(".home-inspiration-card").first()).toHaveCSS("border-radius", "6px");
  await expect(dialog.locator(".home-inspiration-grid")).toHaveCSS("gap", "4px");
  await expect(dialog.locator(".home-inspiration-bar .selection-pill")).toHaveCSS(
    "visibility",
    "visible",
  );
  await dialog.getByRole("button", { name: "搜索灵感", exact: true }).click();
  const searchbox = dialog.getByRole("searchbox", { name: "搜索灵感" });
  await searchbox.fill("水光香氛");
  await expect(dialog.locator(".home-inspiration-card")).toHaveCount(1);
  await searchbox.press("Escape");
  await expect(dialog).toBeVisible();
  const cards = dialog.locator(".home-inspiration-card");
  await expect.poll(() => cards.count()).toBeGreaterThan(1);
  await expect(dialog.locator(".home-inspiration-tile").first()).not.toHaveAttribute(
    "style",
    /opacity|transform/,
  );
  const inspiration = dialog.getByRole("button", { name: "查看灵感：水光香氛", exact: true });
  const useInspiration = dialog.getByRole("button", { name: "做同款：水光香氛", exact: true });
  await inspiration.focus();
  await page.keyboard.press("Tab");
  await expect(useInspiration).toBeFocused();
  await expect(useInspiration).toHaveCSS("opacity", "1");
  const imageBounds = await inspiration.boundingBox();
  const actionBounds = await useInspiration.boundingBox();
  if (!imageBounds || !actionBounds) throw new Error("Missing inspiration card or action bounds");
  expect(actionBounds.x).toBeGreaterThan(imageBounds.x);
  expect(actionBounds.y).toBeGreaterThan(imageBounds.y);
  expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(
    imageBounds.x + imageBounds.width,
  );
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(
    imageBounds.y + imageBounds.height,
  );
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
    /将商品放在水边石台上/,
  );
});

test("素材库 keeps its tab and filters in the address; older favorites links still work", async ({
  page,
}) => {
  const queries = await mockLibrary(page, [
    asset("P10000001"),
    asset("P10000002", { kind: "reference", model: null }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/assets?source=favorites");
  await expect(page.getByRole("heading", { name: "素材库", level: 1 })).toBeAttached();
  await expect(page.getByRole("switch", { name: "仅看收藏" })).toBeChecked();
  await expect(page.getByText("还没有收藏的素材")).toBeVisible();
  expect(queries.at(-1)?.get("favorite")).toBe("true");
  expect(queries.at(-1)?.has("kind")).toBe(false);
  await page.getByText("仅看收藏", { exact: true }).click();
  await expect(page).toHaveURL(/\/assets$/);
  await expect(page.locator(".asset-tile")).toHaveCount(2);
  await page.getByRole("button", { name: "全部来源 素材来源", exact: true }).click();
  await page.getByRole("option", { name: "我上传的" }).click();
  await expect(page).toHaveURL(/\/assets\?source=uploads$/);
  await page.getByRole("tab", { name: "灵感库" }).click();
  await expect(page).toHaveURL(/\/assets\?source=uploads&tab=inspiration$/);
  await expect(page.getByText("挑一张喜欢的画面")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^查看灵感：/ }).first()).toBeVisible();
  await page.getByRole("tab", { name: "我的素材" }).click();
  await expect(page).toHaveURL(/\/assets\?source=uploads$/);
  await expect(page.locator(".asset-tile")).toHaveCount(1);
});

test("素材库 keeps proportions on phones and docks the selection bar at the bottom", async ({
  page,
}) => {
  const assets = [
    asset("P10000001", { hours: 0 }, [1024, 1024]),
    asset("P10000002", { hours: 0.1 }, [960, 1280]),
    asset("P10000003", { hours: 0.2 }, [2048, 1024]),
    asset("P10000004", { hours: 0.3 }, [1280, 960]),
    asset("P10000005", { hours: 0.4 }, [1024, 1024]),
    asset("P10000006", { hours: 0.5 }, [960, 1280]),
  ];
  await mockLibrary(page, assets);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/assets");
  const grid = page.locator(".asset-grid");
  await expect(grid).toHaveCSS("grid-template-columns", /^\S+ \S+$/);
  const tiles = grid.locator(".asset-tile");
  await expect(tiles).toHaveCount(6);
  const boxes = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  for (const [index, box] of boxes.entries()) {
    const original = assets[index];
    if (!original) throw new Error("Missing fixture asset");
    expect(box.width / box.height).toBeCloseTo(original.width / original.height, 1);
    for (const previous of boxes.slice(0, index)) {
      const overlaps =
        box.x < previous.x + previous.width - 1 &&
        box.x + box.width > previous.x + 1 &&
        box.y < previous.y + previous.height - 1 &&
        box.y + box.height > previous.y + 1;
      expect(overlaps).toBe(false);
    }
  }
  expect(
    await tiles
      .locator(".asset-tile-open")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label"))),
  ).toEqual(assets.map((item) => `查看图片：${item.prompt}`));
  await page.getByRole("button", { name: "多选", exact: true }).click();
  await page.getByRole("button", { name: "选择图片：素材 P10000001", exact: true }).click();
  const bar = page.getByRole("toolbar", { name: "多选操作" });
  await expect(bar).toContainText("已选 1 项");
  const barBox = await bar.boundingBox();
  expect(Math.round((barBox?.y ?? 0) + (barBox?.height ?? 0))).toBeLessThanOrEqual(844 - 16);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("a tile whose image fails offers no download and is left out of select all", async ({
  page,
}) => {
  const broken = asset("P55555555", { hours: 0.1 });
  await mockLibrary(page, [asset("P55555551"), broken, asset("P55555553", { hours: 0.2 })]);
  await page.route(`**/api/v1/image-assets/${broken.id}/content*`, (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/assets");
  const tile = page.locator(".asset-tile").filter({
    has: page.getByRole("button", { name: "查看图片：素材 P55555555", exact: true }),
  });
  await expect(tile.getByText("图片加载失败")).toBeVisible();
  await tile.hover();
  // 图片打不开就不能下载：只保留来源与时间，不出现收藏、下载和勾选圈。
  await expect(tile.locator(".asset-tile-foot")).toBeVisible();
  await expect(tile.getByRole("button", { name: "下载原图", exact: true })).toHaveCount(0);
  await expect(tile.getByRole("button", { name: "收藏图片", exact: true })).toHaveCount(0);
  await expect(tile.locator(".asset-tile-check")).toHaveCount(0);
  await page.getByRole("button", { name: "多选", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "选择图片：素材 P55555555", exact: true }),
  ).toBeDisabled();
  const bar = page.getByRole("toolbar", { name: "多选操作" });
  await bar.getByRole("button", { name: "全选", exact: true }).click();
  await expect(bar).toContainText("已选 2 项");
});

test("a refused favorite rolls the star back and explains the limit", async ({ page }) => {
  await mockLibrary(page, [asset("P44444444")]);
  await page.route("**/api/v1/image-assets/*/favorite", (route) =>
    route.fulfill({
      status: 409,
      json: {
        request_id: crypto.randomUUID(),
        code: 30004,
        message: "最多收藏 1000 项，请先取消部分收藏",
        data: {},
        error: { code: "STATE_CONFLICT" },
      },
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/assets");
  const tile = page.locator(".asset-tile").first();
  await tile.hover();
  await tile.getByRole("button", { name: "收藏图片", exact: true }).click();
  await expect(page.getByText("最多收藏 1000 项，请先取消部分收藏")).toBeVisible();
  await expect(tile.getByRole("button", { name: "收藏图片", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("我的素材 keeps filters visible while scrolling and separates the current-tool badge", async ({
  page,
}) => {
  await mockLibrary(
    page,
    Array.from({ length: 48 }, (_, index) =>
      asset(`P${String(index).padStart(8, "0")}`, { tool: "textile" }),
    ),
  );
  await page.setViewportSize({ width: 1328, height: 906 });
  await page.goto("/commerce/textile-set");
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "素材库", exact: true });
  await expect(dialog.locator(".asset-tile")).toHaveCount(48);
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const panel = dialog.locator(".asset-library-panel");
  const scrollbar = dialog.locator(".lycobo-page-scrollbar--panel");
  await expect(scrollbar).toBeVisible();
  await expect(scrollbar).toHaveCSS("position", "absolute");
  await expect(panel).toHaveCSS("scrollbar-width", "none");
  expect(await panel.evaluate((element) => element.offsetWidth - element.clientWidth)).toBe(0);
  const filters = dialog.locator(".asset-filters");
  await expect(filters).toHaveCSS("border-bottom-width", "0px");
  await expect(filters).toHaveCSS("padding-bottom", "20px");
  const before = await filters.boundingBox();
  const gridAtRest = await dialog.locator(".asset-grid").boundingBox();
  if (!before || !gridAtRest) throw new Error("Missing asset filters or grid");
  expect(gridAtRest.y).toBeCloseTo(before.y + before.height);
  await dialog.locator(".asset-tile").first().hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  await expect
    .poll(async () =>
      Math.abs(
        (await panel.evaluate((el) => el.scrollTop)) -
          (await scrollbar.evaluate((el) => el.scrollTop)),
      ),
    )
    .toBeLessThanOrEqual(1);
  await scrollbar.evaluate((element) => {
    element.scrollTop = 160;
  });
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBe(160);
  expect(await filters.boundingBox()).toEqual(before);
  expect(
    await filters.evaluate((element, x) => {
      const { bottom } = element.getBoundingClientRect();
      return document.elementFromPoint(x, bottom - 8) === element;
    }, gridAtRest.x + 8),
  ).toBe(true);
  await dialog.getByRole("button", { name: "家纺裂变 素材来源", exact: true }).click();
  const selected = page.getByRole("option", { name: /家纺裂变/ });
  await expect(selected).toHaveAttribute("aria-selected", "true");
  const badge = await selected.locator(".asset-filter-now").boundingBox();
  const check = await selected.locator(".list-box-item__indicator").boundingBox();
  expect(badge).not.toBeNull();
  expect(check).not.toBeNull();
  expect((badge?.x ?? 0) + (badge?.width ?? 0)).toBeLessThan(check?.x ?? 0);
});

test("素材库 keeps source and filters below the header while scrolling", async ({ page }) => {
  await mockLibrary(
    page,
    Array.from({ length: 64 }, (_, i) => asset(`P${String(i).padStart(8, "0")}`)),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/assets");
  await expect(page.locator(".asset-tile")).toHaveCount(64);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);
  await expect
    .poll(async () => Math.round((await page.locator(".asset-filters").boundingBox())?.y ?? -1))
    .toBe(60);
  await expect(page.getByRole("button", { name: "全部来源 素材来源", exact: true })).toBeVisible();
});
