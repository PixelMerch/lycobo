import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("running images animate with the model icon and stop for reduced motion", async ({ page }) => {
  await mockImageApi(page);
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: "商品场景图",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 4,
    status: "running",
    created_at: "2026-10-20T01:00:00.000Z",
    completed_at: null,
    items: Array.from({ length: 4 }, (_, position) => ({
      id: crypto.randomUUID(),
      position,
      status: position === 0 ? "running" : "queued",
      output_asset_id: null,
      error_code: null,
      width: null,
      height: null,
      worker_id: position === 0 ? "fixture-worker" : null,
    })),
  };
  await page.route("**/api/v1/image-tasks*", (route) => route.fulfill({ json: { data: [job] } }));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/create");
  const loading = page.locator(".generation-results .generation-loading-icon");
  await expect(loading).toHaveCount(4);
  await expect(loading.first()).toHaveCSS("animation-name", "generation-breathe");
  await expect(loading.first().locator("svg")).toHaveClass(/icon-sparkles/);
  const placeholders = page.locator(".generation-placeholder");
  await expect(placeholders).toHaveCount(4);
  await expect(placeholders).toHaveText(["", "", "", ""]);
  await expect(page.locator('.generation-results [aria-label="排队中"]')).toHaveCount(3);
  await expect(page.locator(".history-thumbnail .generation-loading-icon")).toBeVisible();
  const boxes = await placeholders.evaluateAll((elements) =>
    elements.map((element) => ({
      top: element.getBoundingClientRect().top,
      width: element.getBoundingClientRect().width,
    })),
  );
  expect(boxes[0]?.top).toBe(boxes[2]?.top);
  expect(boxes[3]?.top).toBeGreaterThan(boxes[0]?.top ?? 0);
  const borderAngle = () =>
    placeholders
      .first()
      .evaluate((element) =>
        getComputedStyle(element, "::before").getPropertyValue("--generation-angle"),
      );
  const initialAngle = await borderAngle();
  await expect.poll(borderAngle).not.toBe(initialAngle);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(borderAngle).toBe("0deg");
  await expect(loading.first()).toHaveCSS("animation-name", "none");
  await expect(loading.first()).toBeVisible();
  await expect(placeholders.first()).toHaveCSS("aspect-ratio", "1 / 1");
  job.items = job.items.slice(0, 1);
  job.requested_count = 1;
  await page.reload();
  await expect(placeholders).toHaveCount(1);
  const box = await placeholders.first().boundingBox();
  expect(box?.width).toBeLessThanOrEqual(400);
  expect(box?.height).toBe(box?.width);
  await expect(placeholders.first()).toHaveCSS("aspect-ratio", "1 / 1");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.screenshot({ path: "/tmp/lycobo-generation-pending.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  // The resize re-lays out the composer; assert the settled layout, not a frame
  // captured mid-reflow.
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

for (const status of ["failed", "needs_reconciliation", "partially_failed"]) {
  test(`terminal ${status} distinguishes confirmed failure from an unresolved result`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const itemStatus = status === "partially_failed" ? "failed" : status;
    const job = {
      id: crypto.randomUUID(),
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      model: "gpt-image-2",
      prompt: "测试任务",
      resolution: "1K",
      aspect_ratio: "1:1",
      requested_count: 1,
      status,
      created_at: "2026-10-20T01:00:00.000Z",
      completed_at: "2026-10-20T01:01:00.000Z",
      items: [
        {
          id: crypto.randomUUID(),
          position: 0,
          status: itemStatus,
          output_asset_id: null,
          error_code: "PROVIDER_INVALID_IMAGE_RESPONSE",
          width: null,
          height: null,
          worker_id: "fixture-worker",
        },
      ],
    };
    await page.route("**/api/v1/image-tasks*", (route) => route.fulfill({ json: { data: [job] } }));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/create");
    await expect(page.locator(".generation-job header").getByRole("status")).toHaveCount(0);
    await expect(page.locator(".generation-placeholder")).toHaveAttribute(
      "aria-label",
      status === "needs_reconciliation" ? "待确认" : "失败",
    );
    const preview = page.locator(".generation-placeholder");
    const box = await preview.boundingBox();
    const history = await page.locator(".generation-results").boundingBox();
    expect(box?.width).toBeLessThanOrEqual(history?.width ?? 0);
    expect(box?.width).toBeCloseTo(400, 0);
    expect(box?.height).toBeCloseTo(200, 0);
    await expect(preview).toHaveCSS("border-top-width", "0px");
    await expect(preview).toHaveCSS("background-color", "rgb(52, 52, 52)");
    await expect(preview.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
    const message = preview.locator(".generation-failure-message");
    await expect(message).toHaveText(
      status === "needs_reconciliation"
        ? "生成结果和积分状态正在确认，请稍后查看。"
        : "任务未能完成，积分已退回，请您稍后重试。",
    );
    await expect(message).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(page.getByText(/结果待核对|本次调用结果尚未确认|部分完成/)).toHaveCount(0);
    const regenerate = page.getByRole("button", { name: "重新生成", exact: true });
    await expect(regenerate).toBeEnabled();
    await regenerate.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: `/tmp/lycobo-generation-${status}.png` });
  });
}
