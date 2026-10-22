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
  await expect(viewer.locator(".image-preview-bar-id")).toContainText("P00000021");
});
