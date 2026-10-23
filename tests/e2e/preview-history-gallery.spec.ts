import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#aaa"/></svg>';

test("result preview browses successful history images, highlights the entry and loads older tasks", async ({
  page,
}) => {
  await mockImageApi(page);
  const jobs = Array.from({ length: 22 }, (_, index) => ({
    id: crypto.randomUUID(),
    public_id: `W${String(index).padStart(8, "0")}`,
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: `历史图片 ${index + 1}`,
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: index === 3 ? "failed" : index === 5 ? "queued" : "succeeded",
    created_at: new Date(2026, 9, 21, 12, 30 - index).toISOString(),
    completed_at: null,
    input: {
      model: "gpt-image-2",
      prompt: `历史图片 ${index + 1}`,
      resolution: "1K",
      aspectRatio: "1:1",
      count: 1,
      referenceAssetIds: index === 19 ? [crypto.randomUUID()] : [],
    },
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: index === 3 ? "failed" : index === 5 ? "queued" : "succeeded",
        output_asset_id: index === 3 || index === 5 ? null : crypto.randomUUID(),
        output_public_id: `P${String(index).padStart(8, "0")}`,
        error_code: null,
        width: 512,
        height: 512,
        worker_id: "fixture",
      },
    ],
  }));
  await page.route("**/api/v1/image-tasks?*", (route) => {
    const before = new URL(route.request().url()).searchParams.get("before");
    return route.fulfill({
      json: apiFixture({ data: before ? jobs.slice(20) : jobs.slice(0, 20) }),
    });
  });
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto("/create");
  const target = jobs[19];
  if (!target) throw new Error("Missing target fixture");
  await page
    .locator(`[id="job-${target.id}"]`)
    .getByRole("button", { name: "预览图片 1", exact: true })
    .click();
  const viewer = page.getByRole("dialog", { name: "图片预览", exact: true });
  const rail = viewer.getByRole("navigation", { name: "全部图片", exact: true });
  await expect(rail.locator(".image-preview-thumb")).not.toHaveCount(1);
  const selected = rail.locator('[aria-current="true"]');
  await expect(selected.locator("img")).toHaveAttribute(
    "src",
    new RegExp(target.items[0]?.output_asset_id ?? "missing"),
  );
  await expect(viewer.locator(".image-preview-facts")).toContainText(target.public_id);
  // Arrow navigation works immediately after opening, before interacting with the rail.
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator(".image-preview-facts")).toContainText("W00000000");
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator(".image-preview-facts")).toContainText(target.public_id);
  const zoomThumb = viewer.getByRole("slider", { name: "缩放", exact: true });
  await zoomThumb.focus();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator(".image-preview-zoom-value")).toHaveText("110%");
  await viewer.locator(".image-preview-stage").hover();
  await page.mouse.wheel(0, -1);
  await expect
    .poll(() =>
      viewer
        .locator(".image-preview-image")
        .evaluate((image) => Number.parseFloat(getComputedStyle(image).scale)),
    )
    .toBeGreaterThan(1.1);
  await expect(viewer.locator(".image-preview-zoom-value")).toHaveText("110%");
  await page.mouse.wheel(0, -100);
  await expect(viewer.locator(".image-preview-zoom-value")).toHaveText("121%");
  await expect(viewer.locator(".image-preview-facts")).toContainText(target.public_id);

  await expect
    .poll(() =>
      selected.evaluate((node) => {
        const bounds = node.parentElement?.getBoundingClientRect();
        const rect = node.getBoundingClientRect();
        return !!bounds && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
      }),
    )
    .toBe(true);
  const appearance = await selected.evaluate((node) => {
    const outside = document.querySelector('.history-rail .history-thumbnail[aria-current="true"]');
    const image = node.querySelector("img");
    if (!outside || !image) throw new Error("Missing compared thumbnails");
    return {
      radius: getComputedStyle(node).borderRadius,
      outerRadius: getComputedStyle(outside).borderRadius,
      shadow: getComputedStyle(node).boxShadow,
      outerShadow: getComputedStyle(outside).boxShadow,
      inset: image.getBoundingClientRect().left - node.getBoundingClientRect().left,
    };
  });
  expect(appearance.radius).toBe(appearance.outerRadius);
  expect(appearance.shadow).toBe(appearance.outerShadow);
  expect(appearance.inset).toBeGreaterThan(0);
  // The preview rail shares the history rail's hover treatment. That rail sits
  // behind this modal, so it is covered by a dedicated test just below.
  const previewThumb = rail.locator(".image-preview-thumb").first();
  const previewFrame = previewThumb.locator(".history-thumbnail-frame");
  const previewBox = await previewThumb.boundingBox();
  const previewFrameBox = await previewFrame.boundingBox();
  await expect(previewThumb.locator("img")).toHaveCSS("transform", "none");
  await previewThumb.hover();
  await expect(previewThumb.locator("img")).toHaveCSS("transform", "matrix(1.1, 0, 0, 1.1, 0, 0)");
  // The frame keeps its size and corners; the picture is clipped inside it.
  const previewSize = (box: { width: number; height: number } | null) => ({
    width: box?.width,
    height: box?.height,
  });
  expect(previewSize(await previewThumb.boundingBox())).toEqual(previewSize(previewBox));
  expect(previewSize(await previewFrame.boundingBox())).toEqual(previewSize(previewFrameBox));
  await expect(previewFrame).toHaveCSS("overflow", "hidden");
  await expect(viewer.locator(".generation-output-thumbnail")).toHaveCSS("border-radius", "6px");
  await rail.hover();
  await page.mouse.wheel(0, 2000);
  const loadMore = rail.getByRole("button", { name: "加载更多图片", exact: true });
  if (await loadMore.count()) await loadMore.click();
  await expect(rail.locator(".image-preview-thumb")).toHaveCount(20);
  await rail.locator(".image-preview-thumb").last().click();
  await expect(viewer.locator(".image-preview-facts")).toContainText("W00000021");
  await expect(viewer.getByRole("region", { name: "创意描述", exact: true })).toContainText(
    "历史图片 22",
  );
  await expect(viewer.locator(".image-preview-bar-id")).toHaveCount(0);
});

test("history rail thumbnails zoom on hover and keep a stable tile", async ({ page }) => {
  await mockImageApi(page);
  const outputId = crypto.randomUUID();
  const job = {
    id: crypto.randomUUID(),
    public_id: "W10000001",
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "历史缩略图 hover",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "succeeded",
    created_at: "2026-10-21T01:00:00.000Z",
    completed_at: "2026-10-21T01:01:00.000Z",
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "succeeded",
        output_asset_id: outputId,
        output_public_id: "P10000001",
        error_code: null,
        width: 512,
        height: 512,
        worker_id: "fixture",
      },
    ],
  };
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/create");
  const thumb = page.locator(".history-rail .history-thumbnail").first();
  const image = thumb.locator("img");
  const frame = thumb.locator(".history-thumbnail-frame");
  const before = await thumb.boundingBox();
  const beforeFrame = await frame.boundingBox();
  await expect(image).toHaveCSS("transform", "none");
  await thumb.hover();
  await expect(image).toHaveCSS("transform", "matrix(1.1, 0, 0, 1.1, 0, 0)");
  // Only the picture scales; the tile, its padding and the selected ring keep
  // their size, so the frame never changes shape on hover.
  expect(await thumb.boundingBox()).toEqual(before);
  expect(await frame.boundingBox()).toEqual(beforeFrame);
  await expect(frame).toHaveCSS("border-radius", "6px");
  await expect(frame).toHaveCSS("overflow", "hidden");
  // Keyboard focus gets the same feedback.
  await page.mouse.move(0, 0);
  await expect(image).toHaveCSS("transform", "none");
  await thumb.focus();
  await expect(image).toHaveCSS("transform", "matrix(1.1, 0, 0, 1.1, 0, 0)");
});
