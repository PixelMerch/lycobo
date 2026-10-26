import { expect, test } from "@playwright/test";
import {
  type ImageJob,
  imageGenerationInputSchema,
} from "../../packages/contracts/src/image-generation";
import { textileViews } from "../../packages/contracts/src/textile-generation";
import { apiFixture, mockImageEvents } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("textile angles submit one durable ten-image job and keep results separate from creation", async ({
  page,
}) => {
  await mockImageEvents(page);
  const jobs: ImageJob[] = [];
  const referenceIds: string[] = [];
  await page.route("**/api/v1/image-assets", async (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: apiFixture({ data: [] }) });
    const id = crypto.randomUUID();
    referenceIds.push(id);
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
      expect(input.referenceAssetIds).toEqual(referenceIds);
      expect(input.model).toBe("gpt-image-2.5");
      expect(input.resolution).toBe("1K");
      expect(input.quality).toBe("medium");
      const id = crypto.randomUUID();
      jobs.push({
        id,
        public_id: "WTEXTILE1",
        organization_id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        input,
        model: input.model,
        prompt: "家纺主图裂变",
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
    const id = url.pathname.split("/").at(-1);
    const job = jobs.find((entry) => entry.id === id);
    return route.fulfill({
      json: apiFixture(job ?? { data: url.searchParams.get("tool") === "textile" ? jobs : [] }),
    });
  });
  await page.goto("/commerce/textile-set");
  const submit = page.getByRole("button", { name: "立即生成", exact: true });
  await expect(submit).toBeDisabled();
  for (const label of ["主图文件", "详情图文件"])
    await page
      .getByLabel(label, { exact: true })
      .setInputFiles({ name: `${label}.png`, mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "选择裂变类型", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "裂变类型", exact: true });
  for (const view of textileViews)
    await picker.getByRole("button", { name: view.name, exact: true }).click();
  await picker.getByRole("button", { name: "确认", exact: true }).click();
  await expect(submit).toHaveAccessibleDescription("本次生成 10 张，消耗 200 积分");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator(".generation-job")).toHaveCount(1);
  expect(referenceIds.length).toBe(2);
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
        new CustomEvent("fixture:sse", {
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
  await page.reload();
  await expect(page.locator(".generation-results img")).toHaveCount(9);
  await page.getByRole("button", { name: "重新编辑", exact: true }).click();
  await expect(page.locator(".textile-selected-view")).toHaveCount(10);
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await page.getByRole("link", { name: "创作", exact: true }).click();
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
