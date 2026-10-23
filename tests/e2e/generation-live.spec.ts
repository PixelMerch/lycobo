import { expect, test } from "@playwright/test";
import type { ImageGenerationInput, ImageJob } from "../../packages/contracts/src/image-generation";
import { mockImageApi, mockImageEvents, modelNames } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("three public models submit at 1K, queued results become durable history and library assets", async ({
  page,
}) => {
  await mockImageEvents(page);
  const jobs: ImageJob[] = [];
  const submissions: ImageGenerationInput[] = [];
  const organizationId = crypto.randomUUID(),
    userId = crypto.randomUUID();
  let reads = 0;
  await page.route("**/api/v1/image-tasks*", async (route) => {
    if (route.request().method() === "POST") {
      const input: ImageGenerationInput = route.request().postDataJSON();
      submissions.push(input);
      const id = crypto.randomUUID();
      jobs.unshift({
        id,
        organization_id: organizationId,
        user_id: userId,
        model: input.model,
        prompt: input.prompt,
        resolution: input.resolution,
        aspect_ratio: input.aspectRatio,
        requested_count: input.count,
        created_at: new Date().toISOString(),
        completed_at: null,
        status: "queued",
        items: [
          {
            id: crypto.randomUUID(),
            position: 0,
            status: "queued",
            output_asset_id: null,
            error_code: null,
            width: null,
            height: null,
            worker_id: null,
          },
        ],
      });
      await route.fulfill({ status: 202, json: { id, replayed: false } });
    } else {
      if (++reads > 2)
        for (const job of jobs) {
          job.status = "succeeded";
          job.completed_at = new Date().toISOString();
          for (const item of job.items) {
            item.status = "succeeded";
            item.output_asset_id ??= crypto.randomUUID();
            item.width = 1024;
            item.height = 1024;
            item.worker_id = "fixture-worker";
          }
        }
      await route.fulfill({ json: { data: jobs } });
    }
  });
  await page.route("**/api/v1/image-assets**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/content"))
      return route.fulfill({ contentType: "image/png", body: png });
    await route.fulfill({
      json: {
        data: jobs
          .filter((job) => job.status === "succeeded")
          .map((job) => ({
            id: job.items[0]?.output_asset_id,
            kind: "output",
            width: 1024,
            height: 1024,
            bytes: png.length,
            created_at: job.created_at,
            model: job.model,
            prompt: job.prompt,
          })),
      },
    });
  });
  await page.goto("/create");
  for (const model of modelNames) {
    await page.getByRole("button", { name: /创作模型/ }).click();
    await page.getByRole("option", { name: model, exact: true }).click();
    await page.getByLabel("提示词", { exact: true }).fill(`陶瓷杯 ${model}`);
    await page.getByRole("button", { name: "立即生成", exact: true }).click();
    await expect(page.locator(".generation-job")).toHaveCount(submissions.length);
    await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
  }
  expect(submissions.map((input) => input.model)).toEqual(modelNames);
  expect(
    submissions.every(
      (input) =>
        input.resolution === "1K" && input.count === 1 && input.referenceAssetIds.length === 0,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("fixture:sse", { detail: { type: "resync", id: "1" } })),
  );
  await expect(page.locator(".generation-results img")).toHaveCount(modelNames.length, {
    timeout: 12000,
  });
  await page.reload();
  await expect(page.locator(".generation-results img")).toHaveCount(modelNames.length);
  await page.getByRole("link", { name: "素材库", exact: true }).click();
  await expect(page.locator(".asset-grid img")).toHaveCount(modelNames.length);
  await page.reload();
  await expect(page.locator(".asset-grid img")).toHaveCount(modelNames.length);
});

for (const outcome of ["disconnect", "timeout", "auth"] as const) {
  test(`lost submission response (${outcome}) reuses the same key and payload after refresh`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const keys: Array<string | undefined> = [],
      bodies: string[] = [];
    await page.route("**/api/v1/image-tasks", async (route) => {
      if (route.request().method() !== "POST") return route.fulfill({ json: { data: [] } });
      keys.push(route.request().headers()["idempotency-key"]);
      bodies.push(route.request().postData() ?? "");
      if (keys.length === 1) {
        if (outcome === "timeout") return route.fulfill({ status: 408, json: {} });
        if (outcome === "auth") return route.fulfill({ status: 401, json: {} });
        return route.abort("failed");
      }
      await route.fulfill({ json: { id: crypto.randomUUID(), replayed: true } });
    });
    await page.goto("/create");
    await page.getByLabel("提示词", { exact: true }).fill("保留同一次提交");
    await page.getByRole("button", { name: "立即生成", exact: true }).click();
    await expect(page.getByRole("button", { name: "确认上次提交", exact: true })).toBeEnabled();
    await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("保留同一次提交");
    await page.reload();
    await page.getByRole("button", { name: "确认上次提交", exact: true }).click();
    await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(bodies[0]).toBe(bodies[1]);
  });
}

test("unavailable authentication does not show fabricated history or enable generation", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/image-session", (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto("/create");
  await page.getByLabel("提示词", { exact: true }).fill("陶瓷杯");
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
  await expect(page.locator(".generation-results img")).toHaveCount(0);
  await expect(page.getByText("登录已过期，请重新登录工作台。").first()).toBeVisible();
});

test("reference images are uploaded before submitting their server asset IDs", async ({ page }) => {
  await mockImageApi(page);
  const referenceId = crypto.randomUUID();
  let uploaded = false;
  await page.route("**/api/v1/image-assets", async (route) => {
    expect(route.request().headers()["content-type"]).toBe("image/png");
    expect(route.request().postDataBuffer()?.length).toBeGreaterThan(0);
    uploaded = true;
    await route.fulfill({ status: 201, json: { id: referenceId } });
  });
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: [] } });
    expect(uploaded).toBe(true);
    expect(route.request().postDataJSON().referenceAssetIds).toEqual([referenceId]);
    await route.fulfill({ status: 202, json: { id: crypto.randomUUID(), replayed: false } });
  });
  await page.goto("/create");
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("提示词", { exact: true }).fill("保留杯子外形，放在白色置物架上");
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  await expect.poll(() => uploaded).toBe(true);
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("");
  await expect(page.locator(".reference-tile")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
});

test("submission success preserves edits made while the request is pending", async ({ page }) => {
  await mockImageApi(page);
  let accept: (() => void) | undefined;
  const response = new Promise<void>((resolve) => {
    accept = resolve;
  });
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: [] } });
    await response;
    await route.fulfill({ status: 202, json: { id: crypto.randomUUID(), replayed: false } });
  });
  await page.goto("/create");
  await page.getByLabel("提示词", { exact: true }).fill("提交的商品图");
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  await expect(page.getByRole("button", { name: "正在提交…", exact: true })).toBeVisible();
  await page.getByLabel("提示词", { exact: true }).fill("下一张商品图的新要求");
  accept?.();
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeEnabled();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("下一张商品图的新要求");
});
