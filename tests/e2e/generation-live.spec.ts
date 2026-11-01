import { expect, test } from "@playwright/test";
import type { ImageGenerationInput, ImageJob } from "../../packages/contracts/src/image-generation";
import { mockImageApi, mockImageEvents, modelDisplayNames, modelNames } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("four public models submit at 1.5K, queued results become durable history and library assets", async ({
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
    await page
      .getByRole("option", {
        name: modelDisplayNames[modelNames.indexOf(model)] ?? model,
        exact: true,
      })
      .click();
    await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill(`陶瓷杯 ${model}`);
    await page.getByRole("button", { name: "生成商品主图", exact: true }).click();
    await expect(page.locator(".generation-job")).toHaveCount(submissions.length);
    await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeDisabled();
  }
  expect(submissions.map((input) => input.model)).toEqual(modelNames);
  expect(
    submissions.every(
      (input) =>
        input.resolution === "1.5K" && input.count === 1 && input.referenceAssetIds.length === 0,
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
    await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("保留同一次提交");
    await page.getByRole("button", { name: "生成商品主图", exact: true }).click();
    await expect(page.getByRole("button", { name: "确认上次提交", exact: true })).toBeEnabled();
    await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
      "保留同一次提交",
    );
    await page.reload();
    await page.getByRole("button", { name: "确认上次提交", exact: true }).click();
    await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeDisabled();
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
  await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("陶瓷杯");
  await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeDisabled();
  await expect(page.locator(".generation-results img")).toHaveCount(0);
  await expect(page.getByText("登录已过期，请重新登录工作台。").first()).toBeVisible();
});

test("reference images are uploaded before submitting their server asset IDs", async ({ page }) => {
  await mockImageApi(page);
  const referenceId = crypto.randomUUID();
  let uploaded = false;
  await page.route("**/api/v1/image-assets", async (route) => {
    expect(route.request().headers()["content-type"]).toBe("image/png");
    expect(route.request().postDataBuffer()).toEqual(png);
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
  await expect(page.locator(".reference-tile img")).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await page
    .getByLabel(/^(提示词|制作要求)$/, { exact: true })
    .fill("保留杯子外形，放在白色置物架上");
  await page.getByRole("button", { name: "生成商品主图", exact: true }).click();
  await expect.poll(() => uploaded).toBe(true);
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue("");
  await expect(page.locator(".reference-tile")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeDisabled();
});

test("submission success preserves edits made while the request is pending", async ({ page }) => {
  await mockImageApi(page);
  let submissions = 0;
  let accept: (() => void) | undefined;
  const response = new Promise<void>((resolve) => {
    accept = resolve;
  });
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: [] } });
    submissions++;
    await response;
    await route.fulfill({ status: 202, json: { id: crypto.randomUUID(), replayed: false } });
  });
  await page.goto("/create");
  await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("提交的商品图");
  await page.getByRole("button", { name: "生成商品主图", exact: true }).click();
  await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeDisabled();
  const submit = page.getByRole("button", { name: "生成商品主图", exact: true });
  await expect(submit.getByRole("status", { name: "正在提交生图任务" })).toBeVisible();
  await submit.evaluate((node) => {
    if (node instanceof HTMLButtonElement) {
      node.click();
      node.click();
    }
  });
  await expect.poll(() => submissions).toBe(1);
  await expect(page.getByText("正在提交…", { exact: true })).toHaveCount(0);
  await expect(page.getByText("已提交", { exact: true })).toHaveCount(0);
  await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("下一张商品图的新要求");
  accept?.();
  await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeEnabled();
  await expect(page.getByLabel(/^(提示词|制作要求)$/, { exact: true })).toHaveValue(
    "下一张商品图的新要求",
  );
});

test("pending history converges without an SSE notification and stops polling once complete", async ({
  page,
}) => {
  await mockImageEvents(page, false);
  let reads = 0;
  const job: ImageJob = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: "自然光杯子",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "running",
    created_at: new Date().toISOString(),
    completed_at: null,
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "running",
        output_asset_id: null,
        error_code: null,
        width: null,
        height: null,
        worker_id: null,
      },
    ],
  };
  await page.route("**/api/v1/image-tasks?**", async (route) => {
    await route.fulfill({ json: { data: [job] } });
  });
  await page.route(`**/api/v1/image-tasks/${job.id}`, async (route) => {
    reads++;
    if (reads >= 1) {
      job.status = "succeeded";
      job.completed_at = new Date().toISOString();
      job.items[0] = {
        ...job.items[0]!,
        status: "succeeded",
        output_asset_id: crypto.randomUUID(),
        width: 1024,
        height: 1024,
      };
    }
    await route.fulfill({ json: job });
  });
  await page.route("**/api/v1/image-assets/*/content**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.goto("/create");
  await expect(page.locator(".generation-placeholder.generation-pending")).toBeVisible();
  await expect(page.locator(".generation-results .generation-media img")).toBeVisible({
    timeout: 12000,
  });
  await expect(page.locator(".generation-pending")).toHaveCount(0);
  const completedReads = reads;
  await page.waitForTimeout(5500);
  expect(reads).toBe(completedReads);
});

test("idle focus and reconnect do not reload database-backed queries", async ({ page }) => {
  await mockImageEvents(page, false);
  let reads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) reads++;
  });
  await page.goto("/create");
  await expect(page.getByText("生成的图片会显示在这里", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // Advance cache age without a wall-clock wait; the event handlers remain real browser code.
  await page.clock.install();
  await page.clock.fastForward(60000);
  const idleReads = reads;
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("offline"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
  });
  await page.clock.fastForward(60000);
  await page.waitForTimeout(250);
  expect(reads).toBe(idleReads);
});
