import { expect, test } from "@playwright/test";
import {
  type ImageJob,
  imageGenerationInputSchema,
} from "../../../../packages/contracts/src/images/image-generation";
import { textileViews } from "../../../../packages/contracts/src/images/textile-generation";
import { apiFixture, chooseWorkspaceTool, mockImageEvents } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

test("textile angles submit one durable ten-image job and isolate history across tools", async ({
  page,
}) => {
  await mockImageEvents(page);
  await page.route("**/api/v1/image-models", (route) =>
    route.fulfill({
      json: apiFixture({
        enabled: true,
        eventsEnabled: true,
        editsEnabled: true,
        unitCredits: 2,
        models: ["gpt-image-2", "gpt-image-2.6", "nano-banana-2.1"].map((id) => ({
          id,
          enabledResolutions: ["1K", "1.5K", "2K", "4K"],
        })),
      }),
    }),
  );
  const jobs: ImageJob[] = [];
  // 参考图最多三张并行上传，到达顺序不固定，所以按内容认图：只有主图会被压缩，详情图原样上传。
  const uploads: { id: string; body: Buffer }[] = [];
  const mainUploads = () => uploads.filter((upload) => !upload.body.equals(png));
  const detailUploads = () => uploads.filter((upload) => upload.body.equals(png));
  await page.route("**/api/v1/image-assets", async (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: apiFixture({ data: [] }) });
    const id = crypto.randomUUID();
    const body = route.request().postDataBuffer();
    if (!body) throw new Error("Missing reference upload");
    uploads.push({ id, body });
    return route.fulfill({ json: apiFixture({ id }) });
  });
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("**/api/v1/image-tasks**", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      const input = imageGenerationInputSchema.parse(route.request().postDataJSON());
      expect(input.textileSet?.views).toEqual(textileViews.map((view) => view.id));
      expect(input.count).toBe(10);
      // 主图排在第一；五张详情图内容相同，彼此的顺序无法区分。
      const [mainId, ...detailIds] = input.referenceAssetIds;
      expect(mainId).toBe(mainUploads()[0]?.id);
      expect([...detailIds].sort()).toEqual(
        detailUploads()
          .map((upload) => upload.id)
          .sort(),
      );
      expect(input.model).toBe("gpt-image-2.6");
      expect(input.textileSet?.version).toBe(5);
      expect(input.resolution).toBe("2K");
      expect(input.quality).toBe("medium");
      const id = crypto.randomUUID();
      jobs.push({
        id,
        public_id: "WTEXTILE1",
        organization_id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        input,
        model: input.model,
        prompt: "家纺裂变",
        resolution: input.resolution,
        aspect_ratio: input.aspectRatio,
        requested_count: input.count,
        status: "queued",
        created_at: new Date().toISOString(),
        completed_at: null,
        items: textileViews.map((_, position) => ({
          id: crypto.randomUUID(),
          position,
          status: "queued",
          output_asset_id: null,
          error_code: null,
          width: null,
          height: null,
          worker_id: null,
        })),
      });
      return route.fulfill({ status: 202, json: apiFixture({ id, replayed: false }, 202) });
    }
    const ids = url.searchParams.get("ids")?.split(",");
    if (url.pathname.endsWith("/status") && ids)
      return route.fulfill({
        json: apiFixture({ data: jobs.filter((job) => ids.includes(job.id)) }),
      });
    const id = url.pathname.split("/").at(-1);
    const job = jobs.find((entry) => entry.id === id);
    return route.fulfill({
      json: apiFixture(job ?? { data: url.searchParams.get("tool") !== "create" ? jobs : [] }),
    });
  });
  await page.goto("/commerce/textile-set");
  await page.getByRole("radio", { name: "2K", exact: true }).click();
  const submit = page.getByRole("button", { name: "立即生成", exact: true });
  await expect(submit).toBeDisabled();
  const mainFile = page.getByLabel("主图文件", { exact: true });
  await mainFile.evaluate((input: HTMLInputElement) => {
    const selection = new DataTransfer();
    selection.items.add(
      new File([new Uint8Array(51 * 1024 * 1024)], "oversize.png", { type: "image/png" }),
    );
    input.files = selection.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("第 1 张图片超过单张 50 MB 的上限，当前为 51.00 MB。")).toBeVisible();
  expect(uploads).toHaveLength(0);

  const originalSize = await mainFile.evaluate(async (input: HTMLInputElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 5600;
    canvas.height = 3100;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas unavailable");
    const pixels = context.createImageData(canvas.width, canvas.height);
    const words = new Uint32Array(pixels.data.buffer);
    let random = 7927;
    for (let index = 0; index < words.length; index++) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      words[index] = random | 0xff000000;
    }
    context.putImageData(pixels, 0, 0);
    const image = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG unavailable")))),
    );
    const selection = new DataTransfer();
    selection.items.add(new File([image], "main.png", { type: "image/png" }));
    input.files = selection.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return image.size;
  });
  expect(originalSize).toBeGreaterThan(49 * 1024 * 1024);
  expect(originalSize).toBeLessThanOrEqual(50 * 1024 * 1024);
  await page.getByLabel("详情图文件", { exact: true }).setInputFiles(
    Array.from({ length: 5 }, (_, index) => ({
      name: `detail-${index}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await page.getByRole("button", { name: "选择裂变类型", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "裂变类型", exact: true });
  for (const view of textileViews)
    await picker.getByRole("button", { name: view.name, exact: true }).click();
  await picker.getByRole("button", { name: "确认", exact: true }).click();
  await expect(submit).toHaveAccessibleDescription("本次生成 10 张，消耗 20 积分");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator(".generation-job")).toHaveCount(1);
  expect(uploads).toHaveLength(6);
  expect(mainUploads()).toHaveLength(1);
  expect(detailUploads()).toHaveLength(5);
  const compressed = mainUploads()[0]?.body;
  if (!compressed) throw new Error("Missing compressed main image");
  expect(compressed.length).toBeLessThanOrEqual(5 * 1024 * 1024);
  const dimensions = await page.evaluate(async (encoded) => {
    const response = await fetch(`data:image/webp;base64,${encoded}`);
    const bitmap = await createImageBitmap(await response.blob());
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }, compressed.toString("base64"));
  expect(dimensions.width).toBeLessThanOrEqual(3840);
  expect(dimensions.height / dimensions.width).toBeCloseTo(3100 / 5600);
  await expect(page.locator(".reference-tile")).toHaveCount(0);
  await expect(page.locator(".textile-selected-view")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "2K", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator(".textile-result-view")).toHaveText(
    textileViews.map((view) => view.name),
  );
  const job = jobs[0];
  if (!job) throw new Error("Missing fixture job");
  job.status = "partially_failed";
  for (const item of job.items) {
    item.status = item.position === 3 ? "failed" : "succeeded";
    item.output_asset_id = item.position === 3 ? null : crypto.randomUUID();
    item.width = item.height = 1024;
  }
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("fixture:realtime", {
          detail: {
            type: "image.updated",
            id: "1",
            data: { id: "1", kind: "task", resourceId: id },
          },
        }),
      ),
    job.id,
  );
  await expect(page.locator(".generation-failed-result")).toHaveCount(1);
  await expect(page.locator(".generation-results img")).toHaveCount(9);
  const result = page.locator(".generation-results > div").first();
  const label = result.locator(".textile-result-view");
  const labelBox = await label.boundingBox();
  const resultBox = await result.boundingBox();
  if (!labelBox || !resultBox) throw new Error("Missing result label geometry");
  expect(labelBox.y - resultBox.y).toBeCloseTo(6, 0);
  expect(labelBox.x - resultBox.x).toBeCloseTo(6, 0);
  await expect(label).toHaveCSS("font-size", "12px");
  await expect(label).toHaveCSS("pointer-events", "none");

  await page.reload();
  await expect(page.locator(".generation-results img")).toHaveCount(9);
  await page.getByRole("button", { name: "重新编辑", exact: true }).click();
  await expect(page.locator(".textile-selected-view")).toHaveCount(10);
  await expect(page.locator(".reference-tile")).toHaveCount(6);
  await chooseWorkspaceTool(page, "主图制作");
  await expect(page.locator(".generation-job")).toHaveCount(0);
});

test("textile submission keeps its idempotency key after a lost response and reload", async ({
  page,
}) => {
  await mockImageEvents(page);
  await page.route("**/api/v1/image-assets", (route) =>
    route.fulfill({ json: apiFixture({ id: crypto.randomUUID() }) }),
  );
  const bodies: unknown[] = [],
    keys: (string | undefined)[] = [];
  await page.route("**/api/v1/image-tasks", async (route) => {
    bodies.push(route.request().postDataJSON());
    keys.push(route.request().headers()["idempotency-key"]);
    if (bodies.length === 1) return route.abort("failed");
    return route.fulfill({ json: apiFixture({ id: crypto.randomUUID(), replayed: true }) });
  });
  await page.goto("/commerce/textile-set");
  await page
    .getByLabel("主图文件", { exact: true })
    .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "选择裂变类型", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "裂变类型", exact: true });
  await picker.getByRole("button", { name: "正面", exact: true }).click();
  await picker.getByRole("button", { name: "确认", exact: true }).click();
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  await expect(page.getByRole("button", { name: "确认上次提交", exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "确认上次提交", exact: true }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(bodies[1]).toEqual(bodies[0]);
});
