import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const path of ["/commerce/create", "/commerce/textile-set"]) {
  test(`history thumbnails confirm deletion and preserve failed requests on ${path}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    let jobs = ["succeeded", "needs_reconciliation", "failed"].map((status) => ({
      id: crypto.randomUUID(),
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      model: "gpt-image-2",
      prompt: "删除交互测试",
      resolution: "1K",
      aspect_ratio: "1:1",
      requested_count: 1,
      status,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      items: [
        {
          id: crypto.randomUUID(),
          position: 0,
          status,
          output_asset_id: status === "succeeded" ? crypto.randomUUID() : null,
          error_code: null,
          width: 1024,
          height: 1024,
          worker_id: null,
        },
      ],
    }));
    const first = jobs[0];
    if (!first) throw new Error("Missing fixture");
    const firstItem = first.items[0];
    if (!firstItem) throw new Error("Missing fixture item");
    first.items = Array.from({ length: 5 }, (_, position) => ({
      ...firstItem,
      id: crypto.randomUUID(),
      output_asset_id: crypto.randomUUID(),
      position,
    }));
    first.requested_count = 5;
    let deletions = 0,
      reject = true;
    await page.route("**/api/v1/image-tasks?*", (route) =>
      route.fulfill({ json: apiFixture({ data: jobs }) }),
    );
    await page.route("**/api/v1/image-tasks/*", async (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      deletions++;
      if (reject)
        return route.fulfill({
          status: 503,
          json: { ...apiFixture({}, 503), message: "删除失败，请稍后重试。" },
        });
      const id = new URL(route.request().url()).pathname.split("/").at(-1);
      jobs = jobs.filter((job) => job.id !== id);
      return route.fulfill({ json: apiFixture({ id }) });
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(path);
    const rail = page.locator(".history-rail");
    await expect(rail).toBeVisible({ timeout: 30000 });
    await expect(rail.locator(".history-rail-item")).toHaveCount(3);
    const button = rail.getByRole("button", { name: `删除任务 ${first.id}`, exact: true });
    await expect(button).toHaveCSS("opacity", "1");
    await expect(rail.locator(".history-thumbnail-count")).toHaveText("已生成5张图片");
    const unselected = rail.locator(".history-rail-item").nth(1);
    await expect(unselected.locator(".history-thumbnail-delete")).toHaveCSS("opacity", "0");
    await unselected.hover();
    await expect(unselected.locator(".history-thumbnail-delete")).toHaveCSS("opacity", "1");
    await page.mouse.move(1, 1);
    await expect(unselected.locator(".history-thumbnail-delete")).toHaveCSS("opacity", "0");
    await expect(button).toHaveCSS("opacity", "1");
    await rail.locator(".history-rail-item").first().hover();
    await expect(button).toHaveCSS("opacity", "1");
    const corner = await button.boundingBox();
    expect(corner?.width).toBeCloseTo(21.6, 1);
    expect(corner?.height).toBeCloseTo(21.6, 1);
    await button.click();
    const dialog = page.getByRole("dialog", { name: "删除这条历史记录？" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("素材仍在素材库。进行中的任务继续，积分不退。");
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(deletions).toBe(0);
    await expect(page.locator(".toast-region .toast").filter({ hasText: "删除成功" })).toHaveCount(
      0,
    );
    // Keyboard users can reveal the action without hovering.
    await page.mouse.move(1, 1);
    await button.focus();
    await expect(button).toHaveCSS("opacity", "1");
    await button.press("Enter");
    await dialog.getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.locator(".toast-region")).toContainText("删除失败，请稍后重试。");
    await expect(dialog).toBeVisible();
    await expect(rail.locator(".history-rail-item")).toHaveCount(3);
    reject = false;
    await dialog.getByRole("button", { name: "删除", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(rail.locator(".history-rail-item")).toHaveCount(2);
    expect(deletions).toBe(2);
    await expect(page.locator(".toast-region")).toContainText("删除成功");
    const notice = page.locator(".toast-region .toast").filter({ hasText: "删除成功" });
    await expect
      .poll(async () => {
        const box = await notice.boundingBox();
        return box
          ? Math.abs(box.x + box.width / 2 - (page.viewportSize()?.width ?? 0) / 2)
          : Infinity;
      })
      .toBeLessThanOrEqual(1);
    // The same control also deletes unresolved and failed history records.
    for (const job of [...jobs]) {
      const action = rail.getByRole("button", { name: `删除任务 ${job.id}`, exact: true });
      await action.focus();
      await action.press("Enter");
      await dialog.getByRole("button", { name: "删除", exact: true }).click();
      await expect(dialog).toBeHidden();
    }
    await expect(rail.locator(".history-rail-item")).toHaveCount(0);
  });
}

for (const path of ["/commerce/create", "/commerce/textile-set"]) {
  test(`hide history deletion until generation ends on ${path}`, async ({ page }) => {
    await mockImageApi(page);
    const id = crypto.randomUUID();
    let status = "queued";
    await page.route("**/api/v1/image-tasks?*", (route) =>
      route.fulfill({
        json: apiFixture({
          data: [
            {
              id,
              organization_id: crypto.randomUUID(),
              user_id: crypto.randomUUID(),
              model: "gpt-image-2",
              prompt: "任务状态测试",
              resolution: "1K",
              aspect_ratio: "1:1",
              requested_count: 1,
              status,
              created_at: new Date().toISOString(),
              completed_at: null,
              items: [
                {
                  id: crypto.randomUUID(),
                  position: 0,
                  status,
                  output_asset_id: null,
                  error_code: null,
                  width: null,
                  height: null,
                  worker_id: null,
                },
              ],
            },
          ],
        }),
      }),
    );
    for (const next of ["queued", "running", "failed"]) {
      status = next;
      await page.goto(path);
      const rail = page.locator(".history-rail");
      await expect(rail.locator(".history-rail-item")).toHaveCount(1);
      await rail.locator(".history-rail-item").hover();
      await expect(rail.getByRole("button", { name: `删除任务 ${id}`, exact: true })).toHaveCount(
        next === "failed" ? 1 : 0,
      );
    }
  });
}
