import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("task and image IDs stay stable across history, reload and the asset library", async ({
  page,
}) => {
  await mockImageApi(page);
  const id = crypto.randomUUID(),
    assetId = crypto.randomUUID();
  const job = {
    id,
    public_id: "W07AZ9T2Q",
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "短编号示例",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "succeeded",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "succeeded",
        output_asset_id: assetId,
        output_public_id: "P82ZX19M4",
        error_code: null,
        width: 1024,
        height: 1024,
        worker_id: crypto.randomUUID(),
      },
    ],
  };
  await page.route("**/api/v1/image-tasks*", (route) => route.fulfill({ json: { data: [job] } }));
  await page.route("**/api/v1/image-assets**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/content"))
      return route.fulfill({ contentType: "image/png", body: png });
    return route.fulfill({
      json: {
        data: [
          {
            id: assetId,
            public_id: "P82ZX19M4",
            kind: "output",
            width: 1024,
            height: 1024,
            bytes: png.length,
            created_at: job.created_at,
            model: job.model,
            prompt: job.prompt,
          },
        ],
      },
    });
  });
  await page.goto("/create");
  const history = page.locator(".generation-job");
  await expect(history).toContainText("W07AZ9T2Q");
  await expect(history.locator(".image-public-id")).toHaveCount(0);
  await expect(history).not.toContainText(id);
  await expect(history).not.toContainText(job.items[0]?.worker_id ?? "missing");
  await page.reload();
  await expect(history.locator(".image-public-id")).toHaveCount(0);
  await history.getByRole("button", { name: "预览图片 1", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "图片预览", exact: true });
  await expect(preview.locator(".image-preview-facts")).toContainText("ID：W07AZ9T2Q");
  await expect(preview.locator(".image-preview-facts")).not.toContainText("P82ZX19M4");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await preview.getByRole("button", { name: "复制任务 ID W07AZ9T2Q", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("W07AZ9T2Q");
  await expect(preview.locator(".image-preview-bar-id")).toHaveText("Img ID：P82ZX19M4");
  await preview.getByRole("button", { name: "关闭图片预览", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("link", { name: "素材库", exact: true }).click();
  await expect(page.locator(".asset-grid")).toContainText("图片 ID：P82ZX19M4");
});
