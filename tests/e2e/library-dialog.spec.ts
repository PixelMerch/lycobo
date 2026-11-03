import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
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
        (!query.get("model") || row.model?.startsWith(query.get("model") ?? "")) &&
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

test("我的素材 only shows generated images while 素材库 retains its sources", async ({ page }) => {
  const textile = asset("P11111111", { tool: "textile" });
  const created = asset("P22222222", { tool: "create", model: "gpt-image-2" });
  const upload = asset("P33333333", { kind: "reference", model: null });
  const queries = await mockLibrary(page, [textile, created, upload]);
  await page.setViewportSize({ width: 1328, height: 906 });
  await page.goto("/commerce/textile-set");
  const entry = page.getByRole("button", { name: "打开素材库", exact: true });
  await expect(entry).toContainText("我的素材");
  // The library is lazy: browsing the workspace must not load every asset.
  expect(queries).toHaveLength(0);
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "我的素材", exact: true });
  await expect(dialog.getByRole("heading", { name: "我的素材" })).toBeVisible();
  // From the textile rail the 功能 filter starts on 家纺裂变 and the API filters before paging.
  const tiles = dialog.locator(".asset-tile");
  await expect(tiles).toHaveCount(1);
  expect(queries.at(-1)?.get("kind")).toBe("output");
  expect(queries.at(-1)?.has("type")).toBe(false);
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: "在素材库中查看" })).toHaveCount(0);
  await expect(dialog.getByRole("radiogroup", { name: "类型" })).toHaveCount(0);
  expect(queries.at(-1)?.get("tool")).toBe("textile");
  const gridColumns = () =>
    dialog
      .locator(".asset-density-grid")
      .first()
      .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
  await expect.poll(gridColumns).toBe(6);
  await expect(dialog.locator(".asset-day")).toHaveCount(0);
  await dialog.getByRole("button", { name: "全部时间 时间", exact: true }).click();
  await page.getByRole("option", { name: "最近 7 天", exact: true }).click();
  await expect(dialog.locator(".asset-day")).toHaveCount(1);
  expect(queries.at(-1)?.get("since")).toBeTruthy();
  await dialog.getByRole("button", { name: "重置筛选", exact: true }).click();
  await expect(dialog.locator(".asset-day")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "全部时间 时间", exact: true })).toBeVisible();
  const queryCount = queries.length;
  await dialog.getByRole("radio", { name: "中图，每行8张" }).click();
  await expect.poll(gridColumns).toBe(8);
  await dialog.getByRole("radio", { name: "小图，每行10张" }).click();
  await expect.poll(gridColumns).toBe(10);
  expect(queries).toHaveLength(queryCount);
  await dialog.getByRole("radio", { name: "大图，每行6张" }).click();
  await dialog.getByRole("button", { name: "全部类型 类型", exact: true }).click();
  await page.getByRole("option", { name: "视频", exact: true }).click();
  await expect(dialog.getByText("暂无视频素材")).toBeVisible();
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
  await dialog.getByRole("button", { name: "视频 类型", exact: true }).click();
  await page.getByRole("option", { name: "图片", exact: true }).click();
  await expect(tiles).toHaveCount(1);
  expect(queries.at(-1)?.get("type")).toBe("image");
  await dialog.getByRole("button", { name: "重置筛选", exact: true }).click();
  const toolFilter = dialog.getByRole("button", { name: "家纺裂变 功能", exact: true });
  await expect(toolFilter).toHaveAttribute("data-active", "true");
  await expect(dialog.getByRole("button", { name: "查看图片：素材 P11111111" })).toBeVisible();
  // Only generated pictures carry the shared model tag, named from the model catalog.
  await expect(tiles.locator(".asset-tile-badge")).toHaveText("Image 2.5");
  await expect(tiles.locator(".asset-tile-badge")).toHaveClass(/model-tag/);
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const edges = await page.evaluate(() => {
    const left = (selector: string) =>
      document.querySelector<HTMLElement>(selector)?.getBoundingClientRect().x ?? -1;
    return {
      close: left(".library-close svg"),
      tile: left(".asset-tile"),
    };
  });
  expect(edges.close).toBeCloseTo(edges.tile, 0);

  await toolFilter.click();
  await expect(page.getByRole("option")).toHaveText([
    "全部功能",
    "主图制作",
    /家纺裂变\s*当前功能/,
    "套图计划",
  ]);
  await page.getByRole("option", { name: "全部功能" }).click();
  await expect(tiles).toHaveCount(2);
  expect(queries.at(-1)?.has("tool")).toBe(false);
  await dialog.getByRole("button", { name: "全部模型 模型", exact: true }).click();
  await page.getByRole("option", { name: "Image 2.5", exact: true }).click();
  await expect(tiles).toHaveCount(1);
  expect(queries.at(-1)?.get("model")).toBe("gpt-image-2.5");
  // Reset returns to this tool's defaults (served from cache), not to every tool.
  await dialog.getByRole("button", { name: "重置筛选", exact: true }).click();
  await expect(toolFilter).toBeVisible();
  await expect(dialog.getByRole("button", { name: "全部模型 模型", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "查看图片：素材 P11111111" })).toBeVisible();
  await expect(tiles).toHaveCount(1);

  // Favorites are saved on the server; the star stays after the pointer leaves.
  await tiles.first().hover();
  await tiles.first().getByRole("button", { name: "收藏图片", exact: true }).click();
  await expect(
    tiles.first().getByRole("button", { name: "取消收藏", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // Away from pointer and focus, the saved star stays in the tile corner.
  await page.mouse.move(5, 5);
  await dialog.getByRole("button", { name: "关闭我的素材", exact: true }).focus();
  await expect(tiles.first().locator(".asset-tile-star")).toBeVisible();

  await dialog.getByRole("button", { name: "关闭我的素材", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
  await entry.click();
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const box = await dialog.boundingBox();
  expect([box?.x, box?.y, box?.width, box?.height].map((value) => Math.round(value ?? -1))).toEqual(
    [0, 0, 1328, 906],
  );
  await page.screenshot({ path: "/tmp/library-drawer.png" });
  await page.goto("/assets?tool=textile");
  await expect(page).toHaveURL(/\/assets\?tool=textile$/);
  await expect(page.getByRole("heading", { name: "素材库", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await page.getByRole("button", { name: "生成素材 素材来源", exact: true }).click();
  await page.getByRole("option", { name: "上传素材", exact: true }).click();
  await expect(page.locator(".asset-tile")).toHaveCount(1);
  await expect.poll(() => queries.at(-1)?.get("kind")).toBe("reference");
  await page.getByRole("button", { name: "上传素材 素材来源", exact: true }).click();
  await page.getByRole("option", { name: "生成素材", exact: true }).click();
  await expect(page.getByRole("button", { name: "家纺裂变 功能", exact: true })).toBeVisible();
});

test("素材库 shares density and time filters with 我的素材", async ({ page }) => {
  const assets = [
    asset("P10000001", { hours: 0 }, [1024, 1024]),
    asset("P10000002", { hours: 0.1 }, [960, 1280]),
    asset("P10000003", { hours: 0.2 }, [2048, 1024]),
    asset("P10000004", { hours: 0.3 }, [1280, 960]),
    asset("P10000005", { hours: 0.4 }, [1024, 1024]),
    asset("P10000006", { hours: 0.5 }, [960, 1280]),
    asset("P10000007", { hours: 30 }, [1024, 1024]),
  ];
  await mockLibrary(page, assets);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/assets");
  await expect(page.locator(".asset-tile")).toHaveCount(7);
  await expect(page.locator(".asset-day")).toHaveCount(0);
  await expect(page.locator(".asset-density-grid")).toHaveCSS(
    "grid-template-columns",
    /^(\S+ ){5}\S+$/,
  );
  await page.getByRole("button", { name: "全部时间 时间", exact: true }).click();
  await page.getByRole("option", { name: "最近 7 天", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^今天/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^昨天/ })).toBeVisible();
  await page.locator(".asset-tile").first().hover();
  await expect(page.locator(".asset-tile").first().locator(".asset-tile-foot")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.getByRole("button", { name: "查看图片：素材 P10000001" }).click();
  const preview = page.getByRole("dialog", { name: "图片预览", exact: true });
  await expect(preview.locator(".image-preview-facts")).toContainText("图片ID：P10000001");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "全部类型 类型", exact: true }).click();
  await page.getByRole("option", { name: "视频", exact: true }).click();
  await expect(page.getByText("暂无视频素材")).toBeVisible();
  await page.getByRole("button", { name: "视频 类型", exact: true }).click();
  await page.getByRole("option", { name: "图片", exact: true }).click();
  await expect(page).toHaveURL(/type=image/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".asset-density-grid").first()).toHaveCSS(
    "grid-template-columns",
    /^\S+ \S+$/,
  );
  await expect(page.getByRole("button", { name: "图片 类型", exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: "/tmp/library-mobile.png" });
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
  const dialog = page.getByRole("dialog", { name: "我的素材", exact: true });
  await expect(dialog.locator(".asset-tile")).toHaveCount(48);
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const filters = dialog.locator(".asset-filters");
  const before = await filters.boundingBox();
  await dialog.locator(".asset-tile").first().hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => dialog.locator(".library-body").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  const after = await filters.boundingBox();
  expect(after?.y).toBeCloseTo(before?.y ?? -1, 0);
  await dialog.getByRole("button", { name: "家纺裂变 功能", exact: true }).click();
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
    Array.from({ length: 48 }, (_, i) => asset(`P${String(i).padStart(8, "0")}`)),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/assets");
  await expect(page.locator(".asset-tile")).toHaveCount(48);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);
  await expect
    .poll(async () => Math.round((await page.locator(".asset-filters").boundingBox())?.y ?? -1))
    .toBe(60);
  await expect(page.getByRole("button", { name: "生成素材 素材来源", exact: true })).toBeVisible();
});
