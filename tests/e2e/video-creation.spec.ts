import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
for (const width of [390, 1440]) {
  test(`video parameters preserve drafts, show six illustrated ratios and allow integer durations from 5 to 30 seconds at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.route("**/api/v1/video-model", (route) =>
      route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
    );
    await page.route("**/api/v1/video-tasks", (route) =>
      route.fulfill({ json: apiFixture({ data: [] }) }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/textile-set");
    await page
      .getByLabel("主图文件", { exact: true })
      .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
    const tools = page.getByRole("navigation", { name: "电商创作工具" });
    await tools.getByRole("button", { name: "视频创作", exact: true }).click();
    const composer = page.getByRole("region", { name: "视频创作参数" });
    await expect(composer.locator(".reference-image-card")).toHaveCount(1);
    await expect(composer.getByText("Minimax-h3-933特价", { exact: true })).toHaveCount(0);
    await expect(composer.getByText("768p", { exact: true })).toHaveCount(0);
    await expect(composer.getByText("首帧图", { exact: true })).toHaveCount(0);
    await expect(composer.getByText("尾帧图", { exact: true })).toHaveCount(0);
    await expect(composer.locator(".home-ratio-track .toggle-button")).toHaveText([
      "9:16",
      "16:9",
      "21:9",
      "4:3",
      "3:4",
      "1:1",
    ]);
    const prompt = page.getByLabel("场景描述", { exact: true });
    await prompt.fill("镜头缓慢推近，床品在晨光中展开");
    await composer.getByRole("radio", { name: "16:9", exact: true }).click();
    const durationTrack = composer.locator(".video-duration-track");
    const hoverBox = await durationTrack.boundingBox();
    if (!hoverBox) throw new Error("Duration track missing");
    await page.mouse.move(hoverBox.x + hoverBox.width * 0.52, hoverBox.y + hoverBox.height / 2);
    await expect(page.getByRole("tooltip")).toHaveText("18秒");
    await expect(composer.getByRole("slider")).toHaveValue("10");
    await page.mouse.move(0, 0);
    const slider = composer.getByRole("slider");
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(composer.getByRole("slider")).toHaveValue("11");
    await page.keyboard.press("ArrowRight");
    await expect(composer.getByRole("slider")).toHaveValue("12");
    const track = composer.locator(".video-duration-track");
    const box = await track.boundingBox();
    if (!box) throw new Error("Slider track missing");
    await page.mouse.move(box.x + (box.width * 2) / 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(composer.getByRole("slider")).toHaveValue("30");
    await expect(composer.getByRole("button", { name: /立即生成.*100/ })).toBeEnabled();
    await tools.getByRole("button", { name: "主图制作", exact: true }).click();
    await tools.getByRole("button", { name: "视频创作", exact: true }).click();
    await expect(prompt).toHaveValue("镜头缓慢推近，床品在晨光中展开");
    await expect(composer.getByRole("slider")).toHaveValue("30");
    await expect(composer.locator(".reference-image-card")).toHaveCount(1);
    await page.screenshot({ path: `/tmp/lycobo-video-${width}.png` });
  });
}

test("video text-only submission is durable, uses the selected duration and does not call image generation", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/video-model", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
  );
  const id = crypto.randomUUID();
  let task: object | null = null;
  let balance = 200;
  let reads = 0;
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({ json: apiFixture({ balance, unitCredits: 2 }) }),
  );
  const submissions: unknown[] = [];
  let imageSubmissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      imageSubmissions++;
  });
  await page.route("**/api/v1/video-tasks", async (route) => {
    if (route.request().method() === "POST") {
      balance = 100;
      const input = route.request().postDataJSON();
      submissions.push(input);
      expect(route.request().headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/);
      task = {
        id,
        public_id: "W09VIDEO1",
        prompt: input.prompt,
        status: "queued",
        created_at: new Date().toISOString(),
        input: { video: input },
        error_code: null,
        asset_id: null,
        provider_status: "queued",
      };
      await route.fulfill({ status: 202, json: apiFixture({ id, replayed: false }) });
    } else {
      if (task && ++reads > 1) {
        task = { ...task, status: "failed", error_code: "VIDEO_PROVIDER_FAILED" };
        balance = 200;
      }
      await route.fulfill({ json: apiFixture({ data: task ? [task] : [] }) });
    }
  });
  await page.goto("/video");
  const submit = page.getByRole("button", { name: /立即生成.*100/ });
  await expect(submit).toBeDisabled();
  const description = page.getByLabel("场景描述", { exact: true });
  await expect(description).toHaveAttribute("required", "");
  await description.fill("   ");
  await expect(submit).toBeDisabled();
  await description.fill("俯拍商品，镜头平稳向前推进");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toEqual({
    prompt: "俯拍商品，镜头平稳向前推进",
    seconds: 10,
    aspectRatio: "9:16",
    referenceAssetIds: [],
  });
  await expect(page.getByRole("article", { name: "视频任务：W09VIDEO1" })).toContainText("排队中");
  expect(imageSubmissions).toBe(0);
  await expect(page.locator(".header-balance-value")).toHaveText("100");
  await expect(page.getByRole("article", { name: "视频任务：W09VIDEO1" })).toContainText(
    "积分已退回",
    { timeout: 15000 },
  );
  await expect(page.locator(".header-balance-value")).toHaveText("200");
});

test("an ambiguous video submission retains its immutable idempotency key when the draft changes", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/video-model", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
  );
  const attempts: { key: string | undefined; body: unknown }[] = [];
  await page.route("**/api/v1/video-tasks", async (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: apiFixture({ data: [] }) });
    attempts.push({
      key: route.request().headers()["idempotency-key"],
      body: route.request().postDataJSON(),
    });
    if (attempts.length === 1) return route.abort("failed");
    return route.fulfill({
      status: 202,
      json: apiFixture({ id: crypto.randomUUID(), replayed: true }),
    });
  });
  await page.goto("/video");
  const prompt = page.getByLabel("场景描述", { exact: true });
  await prompt.fill("原始视频画面");
  await page.getByRole("button", { name: /立即生成.*100/ }).click();
  await expect(page.getByRole("button", { name: /确认上次提交/ })).toBeEnabled();
  await prompt.fill("准备下一条的新草稿");
  await page.getByRole("button", { name: /确认上次提交/ }).click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toEqual(attempts[0]);
  await expect(prompt).toHaveValue("准备下一条的新草稿");
});

test("completed video fixtures play through the real browser media element", async ({ page }) => {
  await mockImageApi(page);
  await page.route("**/api/v1/video-model", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
  );
  const bytes = await readFile(new URL("../fixtures/video-playback.mp4", import.meta.url));
  await page.route("**/fixture-video.mp4", (route) =>
    route.fulfill({ status: 200, contentType: "video/mp4", body: bytes }),
  );
  await page.route("**/api/v1/video-tasks", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id: crypto.randomUUID(),
            public_id: "W09VIDEO2",
            prompt: "已完成的视频fixture",
            status: "succeeded",
            created_at: new Date().toISOString(),
            input: {
              video: {
                prompt: "已完成的视频fixture",
                seconds: 10,
                aspectRatio: "9:16",
                referenceAssetIds: [],
              },
            },
            error_code: null,
            asset_id: crypto.randomUUID(),
            provider_status: "completed",
            delivery: {
              url: "http://127.0.0.1:5173/fixture-video.mp4",
              download_url: "http://127.0.0.1:5173/fixture-video.mp4",
            },
          },
        ],
      }),
    }),
  );
  await page.goto("/video");
  const task = page.getByRole("article", { name: "视频任务：W09VIDEO2" });
  await expect(task).toContainText("已完成");
  const player = task.locator("video");
  await player.evaluate(async (element) => {
    if (!(element instanceof HTMLVideoElement)) throw new Error("Video element missing");
    element.muted = true;
    await element.play();
  });
  await expect
    .poll(() =>
      player.evaluate((element) => (element instanceof HTMLVideoElement ? element.currentTime : 0)),
    )
    .toBeGreaterThan(0);
  await expect(task.getByRole("link", { name: "下载视频" })).toHaveAttribute(
    "href",
    "http://127.0.0.1:5173/fixture-video.mp4",
  );
});

test("asset grids defer video loading until the video preview opens", async ({ page }) => {
  await mockImageApi(page);
  const id = crypto.randomUUID();
  const bytes = await readFile(new URL("../fixtures/video-playback.mp4", import.meta.url));
  const delivery = {
    url: "http://127.0.0.1:5173/fixture-video.mp4",
    thumbnail_url: "http://127.0.0.1:5173/fixture-video.mp4",
    download_url: "http://127.0.0.1:5173/fixture-video.mp4",
    expires_at: 9999999999,
  };
  let mediaReads = 0;
  await page.route("**/fixture-video.mp4", (route) => {
    mediaReads++;
    return route.fulfill({ contentType: "video/mp4", body: bytes });
  });
  await page.route("**/api/v1/image-assets?**", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id,
            public_id: "PCNLH66GX",
            task_public_id: "W12345678",
            kind: "output",
            type: "video",
            tool: "video",
            width: 64,
            height: 64,
            bytes: bytes.length,
            created_at: new Date().toISOString(),
            model: null,
            prompt: "素材库视频fixture",
            delivery,
          },
        ],
      }),
    }),
  );
  await page.route(`**/api/v1/image-assets/${id}/delivery`, (route) =>
    route.fulfill({ json: apiFixture({ id, delivery }) }),
  );
  await page.goto("/assets?type=video");
  const tile = page.getByRole("button", { name: "查看视频：素材库视频fixture", exact: true });
  await expect(tile).toBeVisible();
  await expect(tile.locator("img,video")).toHaveCount(0);
  expect(mediaReads).toBe(0);
  await tile.click();
  const preview = page.getByRole("dialog", { name: "视频预览", exact: true });
  await expect(preview.locator("video")).toBeVisible();
  await expect.poll(() => mediaReads).toBeGreaterThan(0);
  await preview.getByRole("button", { name: "关闭视频预览", exact: true }).click();
  await expect(tile).toBeFocused();
});
