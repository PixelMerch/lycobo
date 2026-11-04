import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { expect, type Page, test } from "@playwright/test";
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
    await durationTrack.scrollIntoViewIfNeeded();
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

for (const width of [390, 1440]) {
  test(`completed video fixtures show portrait covers, play on demand and download only on request at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockImageApi(page);
    await page.route("**/api/v1/video-model", (route) =>
      route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
    );
    const coverBytes = await readFile(new URL("../fixtures/video-cover.webp", import.meta.url));
    const assetId = crypto.randomUUID();
    const playbackUrl = "http://127.0.0.1:5173/fixture-playback.mp4";
    let playbackReads = 0;
    let downloadReads = 0;
    const bytes = await readFile(new URL("../fixtures/video-portrait.mp4", import.meta.url));
    await page.route("**/fixture-playback.mp4", (route) => {
      playbackReads++;
      return route.fulfill({ status: 200, contentType: "video/mp4", body: bytes });
    });
    const downloadServer = createServer((_request, response) => {
      downloadReads++;
      response.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=original.mp4",
      });
      response.end(bytes);
    });
    await new Promise<void>((resolve) => downloadServer.listen(0, "127.0.0.1", resolve));
    const address = downloadServer.address();
    if (!address || typeof address === "string") throw new Error("Fixture server missing");
    const downloadUrl = `http://127.0.0.1:${address.port}/original.mp4`;
    try {
      await page.route(`**/api/v1/image-assets/${assetId}/content?thumbnail=1`, (route) =>
        route.fulfill({ contentType: "image/webp", body: coverBytes }),
      );
      await page.route(`**/api/v1/image-assets/${assetId}/delivery`, (route) =>
        route.fulfill({
          json: apiFixture({
            id: assetId,
            delivery: {
              url: playbackUrl,
              thumbnail_url: "http://127.0.0.1:5173/fixture-cover.webp",
              download_url: downloadUrl,
              expires_at: 9999999999,
            },
          }),
        }),
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
                asset_id: assetId,
                provider_status: "completed",
                delivery: {
                  url: playbackUrl,
                  download_url: downloadUrl,
                },
              },
            ],
          }),
        }),
      );
      await page.goto("/video");
      if (width === 390) await page.getByRole("radio", { name: "历史记录", exact: true }).click();
      const task = page.getByRole("article", { name: "视频任务：W09VIDEO2" });
      await expect(task.getByRole("button", { name: "预览视频：W09VIDEO2" })).toBeVisible();
      await expect(task.locator("video")).toHaveCount(0);
      await expect(task.locator(".video-cover-image")).toBeVisible();
      await expect(task.locator(".video-cover-image")).toHaveCSS("opacity", "1");
      await expect
        .poll(() =>
          task
            .locator(".video-cover-image")
            .evaluate(
              (node) => node instanceof HTMLImageElement && node.naturalHeight > node.naturalWidth,
            ),
        )
        .toBe(true);
      const coverBox = await task.locator(".video-cover").boundingBox();
      expect(coverBox && coverBox.height > coverBox.width).toBe(true);
      expect(coverBox?.height ?? 0).toBeLessThanOrEqual(321);
      await expect(task).not.toContainText("纯文字");
      await expect(
        page.locator('.history-rail[aria-label="视频历史索引"] .history-thumbnail-frame img'),
      ).toHaveCount(1);
      const imageBox = await task.locator(".video-cover-image").boundingBox();
      expect(imageBox?.width).toBeCloseTo(coverBox?.width ?? 0, 0);
      expect(imageBox?.height).toBeCloseTo(coverBox?.height ?? 0, 0);
      await page.screenshot({ path: testInfo.outputPath("video-cover.png") });
      expect(playbackReads).toBe(0);
      expect(downloadReads).toBe(0);
      await expect(task).toContainText("9:16");
      await expect(task).toContainText("10秒");
      await expect(task).not.toContainText("消耗 100 积分");
      await expect(task.locator(".generation-meta-ratio .ui-icon")).toBeVisible();
      await expect(task.locator(".video-history-tag")).toHaveCSS("color", "rgb(185, 224, 255)");
      await expect(task.locator("time")).toHaveCount(1);
      await expect(task.getByRole("button", { name: "复制任务 ID W09VIDEO2" })).toBeVisible();
      await task.getByRole("button", { name: "预览视频：W09VIDEO2" }).click();
      const dialog = page.getByRole("dialog", { name: "视频预览", exact: true });
      const frame = dialog.locator(".video-preview-frame");
      await expect(frame).toBeVisible();
      const info = dialog.getByRole("complementary", { name: "视频信息" });
      await expect(info).toContainText("任务ID：W09VIDEO2");
      await expect(info).toContainText("已完成的视频fixture");
      await expect(info.getByRole("region", { name: "视频参数" })).toContainText("9:16");
      await expect(info.getByRole("region", { name: "视频参数" })).toContainText("10秒");
      await expect(info.getByRole("button", { name: "下载视频" })).toBeVisible();
      await expect(
        dialog.getByRole("navigation", { name: "全部视频" }).locator(".image-preview-thumb"),
      ).toHaveCount(1);
      const player = dialog.locator("video");
      // Product controls replace the browser chrome and its download menu.
      expect(await player.getAttribute("controls")).toBeNull();
      await expect(player).toHaveAttribute("controlslist", "nodownload");
      await expect(player).toHaveAttribute("src", playbackUrl);
      const frameBox = await frame.boundingBox();
      expect(
        frameBox &&
          frameBox.x >= 0 &&
          frameBox.x + frameBox.width <= width &&
          frameBox.height > frameBox.width,
      ).toBe(true);
      await player.evaluate(async (element) => {
        if (!(element instanceof HTMLVideoElement)) throw new Error("Video element missing");
        element.muted = true;
        await element.play();
      });
      await expect
        .poll(() =>
          player.evaluate((element) =>
            element instanceof HTMLVideoElement ? element.currentTime : 0,
          ),
        )
        .toBeGreaterThan(0);
      await page.screenshot({ path: testInfo.outputPath("video-preview.png") });
      await expect(task.getByRole("link", { name: "下载视频" })).toHaveAttribute(
        "href",
        downloadUrl,
      );
      expect(playbackReads).toBeGreaterThan(0);
      expect(downloadReads).toBe(0);
      await dialog.getByRole("button", { name: "关闭视频预览", exact: true }).click();
      await expect(task.getByRole("button", { name: "预览视频：W09VIDEO2" })).toBeFocused();
      const download = page.waitForEvent("download");
      await task.getByRole("link", { name: "下载视频", exact: true }).click();
      const downloaded = await download;
      const downloadedPath = await downloaded.path();
      if (!downloadedPath) throw new Error("Video download missing");
      expect(await readFile(downloadedPath)).toEqual(bytes);
      await expect.poll(() => downloadReads).toBe(1);
      await task.getByRole("button", { name: "重新编辑", exact: true }).click();
      await expect(page.getByLabel("场景描述", { exact: true })).toHaveValue("已完成的视频fixture");
    } finally {
      downloadServer.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        downloadServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}

async function mockCompletedVideos(
  page: Page,
  publicIds: string[],
  beforeDelivery?: Promise<void>,
) {
  await mockImageApi(page);
  await page.route("**/api/v1/video-model", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
  );
  const tasks: unknown[] = [];
  for (const publicId of publicIds) {
    const assetId = crypto.randomUUID();
    const url = `http://127.0.0.1:5173/fixture-${publicId}.mp4`;
    const delivery = {
      url,
      thumbnail_url: `http://127.0.0.1:5173/fixture-${publicId}-cover.webp`,
      download_url: `http://127.0.0.1:5173/fixture-${publicId}-original.mp4`,
      expires_at: 9999999999,
    };
    await page.route(`**/fixture-${publicId}-cover.webp`, (route) =>
      route.fulfill({ contentType: "image/png", body: png }),
    );
    await page.route(`**/api/v1/image-assets/${assetId}/content?thumbnail=1`, (route) =>
      route.fulfill({ contentType: "image/png", body: png }),
    );
    await page.route(`**/api/v1/image-assets/${assetId}/delivery`, async (route) => {
      await beforeDelivery;
      await route.fulfill({ json: apiFixture({ id: assetId, delivery }) });
    });
    tasks.push({
      id: crypto.randomUUID(),
      public_id: publicId,
      prompt: `视频预览fixture ${publicId}`,
      status: "succeeded",
      created_at: new Date().toISOString(),
      input: {
        video: {
          prompt: `视频预览fixture ${publicId}`,
          seconds: 5,
          aspectRatio: "9:16",
          referenceAssetIds: [],
        },
      },
      error_code: null,
      asset_id: assetId,
      provider_status: "completed",
      delivery: { url, download_url: delivery.download_url },
    });
  }
  await page.route("**/api/v1/video-tasks", (route) =>
    route.fulfill({ json: apiFixture({ data: tasks }) }),
  );
}

for (const width of [390, 1440]) {
  test(`opening a video shows loading on the video, not under the cover at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let release = () => {};
    await mockCompletedVideos(
      page,
      ["W09VIDEO4"],
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    await page.goto("/video");
    if (width === 390) await page.getByRole("radio", { name: "历史记录", exact: true }).click();
    const task = page.getByRole("article", { name: "视频任务：W09VIDEO4" });
    await expect(task.locator(".video-cover-image")).toHaveCSS("opacity", "1");
    await task.getByRole("button", { name: "预览视频：W09VIDEO4" }).click();
    const dialog = page.getByRole("dialog", { name: "视频预览", exact: true });
    const loading = dialog.locator(".video-preview-loading");
    await expect(loading).toBeVisible();
    await expect(task.locator(".spinner")).toHaveCount(0);
    await expect
      .poll(async () => {
        const [spinner, frame] = await Promise.all([
          loading.boundingBox(),
          dialog.locator(".video-preview-frame").boundingBox(),
        ]);
        return spinner && frame
          ? Math.round(
              Math.hypot(
                spinner.x + spinner.width / 2 - frame.x - frame.width / 2,
                spinner.y + spinner.height / 2 - frame.y - frame.height / 2,
              ),
            )
          : -1;
      })
      .toBe(0);
    release();
  });
}

test("video detail switches through every video from the rail and arrow keys", async ({ page }) => {
  await mockCompletedVideos(page, ["W09VIDEO5", "W09VIDEO6", "W09VIDEO7"]);
  const bytes = await readFile(new URL("../fixtures/video-portrait.mp4", import.meta.url));
  await page.route(/fixture-W09VIDEO\d\.mp4$/, (route) =>
    route.fulfill({ contentType: "video/mp4", body: bytes }),
  );
  await page.goto("/video");
  await page.getByRole("button", { name: "预览视频：W09VIDEO6" }).click();
  const dialog = page.getByRole("dialog", { name: "视频预览", exact: true });
  const info = dialog.getByRole("complementary", { name: "视频信息" });
  const rail = dialog.getByRole("navigation", { name: "全部视频" });
  const showing = async (publicId: string) => {
    await expect(info).toContainText(`任务ID：${publicId}`);
    await expect(info).toContainText(`视频预览fixture ${publicId}`);
    await expect(dialog.locator("video")).toHaveAttribute("src", new RegExp(`${publicId}\\.mp4$`));
  };
  await expect(rail.locator(".image-preview-thumb")).toHaveCount(3);
  await expect(rail.getByRole("button", { name: "预览第 2 个视频" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await showing("W09VIDEO6");
  await rail.getByRole("button", { name: "预览第 3 个视频" }).click();
  await showing("W09VIDEO7");
  await page.keyboard.press("ArrowUp");
  await showing("W09VIDEO6");
  await page.keyboard.press("ArrowUp");
  await showing("W09VIDEO5");
  await expect(rail.getByRole("button", { name: "预览第 1 个视频" })).toHaveAttribute(
    "aria-current",
    "true",
  );
});

for (const ranges of [true, false]) {
  test(`video preview ${ranges ? "scrubs with range support" : "stays playable without range support"}`, async ({
    page,
  }) => {
    await mockCompletedVideos(page, ["W09VIDEO3"]);
    const bytes = await readFile(new URL("../fixtures/video-portrait.mp4", import.meta.url));
    await page.route("**/fixture-W09VIDEO3.mp4", (route) => {
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? "");
      if (!ranges || !range)
        return route.fulfill({
          contentType: "video/mp4",
          body: bytes,
          headers: ranges ? { "Accept-Ranges": "bytes" } : {},
        });
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : bytes.length - 1;
      return route.fulfill({
        status: 206,
        contentType: "video/mp4",
        body: bytes.subarray(start, end + 1),
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        },
      });
    });
    await page.goto("/video");
    await page.getByRole("button", { name: "预览视频：W09VIDEO3" }).click();
    const dialog = page.getByRole("dialog", { name: "视频预览", exact: true });
    const player = dialog.locator("video");
    const progress = dialog.getByRole("slider", { name: "播放进度" });
    const time = () =>
      player.evaluate((element) =>
        element instanceof HTMLVideoElement ? element.currentTime : -1,
      );
    await expect.poll(time).toBeGreaterThan(0);
    if (!ranges) {
      // Seeking an unseekable file would restart it, so the bar only reports progress.
      await expect(progress).toBeDisabled();
      return;
    }
    await expect(progress).toBeEnabled();
    await player.evaluate((element) => {
      if (element instanceof HTMLVideoElement) element.pause();
    });
    await progress.focus();
    // Each key acts on the slider's rendered value, so wait for it to follow the media clock.
    const shown = () => progress.inputValue().then(Number);
    await page.keyboard.press("End");
    await expect.poll(time).toBeGreaterThan(0.9);
    await expect.poll(shown).toBeGreaterThan(0.9);
    await page.keyboard.press("Home");
    await expect.poll(time).toBe(0);
    await expect.poll(shown).toBe(0);
    await page.keyboard.press("ArrowRight");
    await expect.poll(time).toBeCloseTo(0.1, 1);
  });
}

test("asset grids defer video loading until the video preview opens", async ({ page }) => {
  await mockImageApi(page);
  const id = crypto.randomUUID();
  const bytes = await readFile(new URL("../fixtures/video-playback.mp4", import.meta.url));
  const delivery = {
    url: "http://127.0.0.1:5173/fixture-video.mp4",
    thumbnail_url: "http://127.0.0.1:5173/fixture-cover.webp",
    download_url: "http://127.0.0.1:5173/fixture-video.mp4",
    expires_at: 9999999999,
  };
  await page.route("**/fixture-cover.webp", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
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
            duration_seconds: 10,
            resolution: "768p",
            delivery,
          },
        ],
      }),
    }),
  );
  await page.route(`**/api/v1/image-assets/${id}/delivery`, (route) =>
    route.fulfill({ json: apiFixture({ id, delivery }) }),
  );
  await page.route(`**/api/v1/image-assets/${id}/content?thumbnail=1`, (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.goto("/assets?type=video");
  const tile = page.getByRole("button", { name: "查看视频：素材库视频fixture", exact: true });
  await expect(tile).toBeVisible();
  await expect(tile.locator("img")).toHaveCount(1);
  await expect(tile.locator("video")).toHaveCount(0);
  expect(mediaReads).toBe(0);
  const card = page.locator(".asset-tile").filter({ has: tile });
  await expect(tile.locator(".video-cover-play")).toBeVisible();
  await expect(card.locator(".asset-tile-badge")).toHaveText("视频创作");
  await expect(card.locator(".asset-tile-specs")).toHaveText("768p · 0:10");
  await expect(card.locator(".asset-tile-meta")).toBeEmpty();
  await tile.click();
  const preview = page.getByRole("dialog", { name: "视频预览", exact: true });
  await expect(preview.locator("video")).toBeVisible();
  await expect.poll(() => mediaReads).toBeGreaterThan(0);
  await preview.getByRole("button", { name: "关闭视频预览", exact: true }).click();
  await expect(tile).toBeFocused();
});

for (const editWhilePending of [false, true]) {
  test(`video submission animates and ${editWhilePending ? "preserves the next draft" : "clears accepted content while retaining parameters"}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.route("**/api/v1/video-model", (route) =>
      route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
    );
    let release: (() => void) | undefined;
    let requests = 0;
    await page.route("**/api/v1/video-tasks", async (route) => {
      if (route.request().method() !== "POST")
        return route.fulfill({ json: apiFixture({ data: [] }) });
      requests++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({
        status: 202,
        json: apiFixture({ id: crypto.randomUUID(), replayed: false }),
      });
    });
    await page.goto("/video");
    const composer = page.getByRole("region", { name: "视频创作参数" });
    const prompt = page.getByLabel("场景描述", { exact: true });
    await prompt.fill("镜头缓慢推近商品");
    await composer.getByRole("radio", { name: "16:9", exact: true }).click();
    await page
      .getByLabel("添加参考图片", { exact: true })
      .setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: png });
    await expect(composer.locator(".reference-image-card")).toHaveCount(1);
    const button = composer.getByRole("button", { name: /立即生成.*100/ });
    await button.click();
    await expect.poll(() => requests).toBe(1);
    await expect(button).toBeDisabled();
    await expect(button).toHaveClass(/generation-pending/);
    await expect(page.getByRole("status", { name: "正在提交视频任务" })).toBeVisible();
    await expect
      .poll(() => button.evaluate((node) => getComputedStyle(node, "::before").animationName))
      .toBe("generation-border-flow");
    if (editWhilePending) await prompt.fill("下一条视频的新场景");
    release?.();
    await expect(button).not.toHaveAttribute("data-submitting", "true");
    await expect(prompt).toHaveValue(editWhilePending ? "下一条视频的新场景" : "");
    await expect(composer.locator(".reference-image-card")).toHaveCount(editWhilePending ? 1 : 0);
    await expect(composer.locator(".ratio-current")).toHaveText("16:9");
    await expect(composer.getByRole("slider")).toHaveValue("10");
    expect(requests).toBe(1);
  });
}

test("video history matches image spacing and typography, regenerates with confirmation and protects the draft", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const id = crypto.randomUUID();
  const input = { prompt: "商品视频", seconds: 15, aspectRatio: "16:9", referenceAssetIds: [] };
  const imageJob = {
    id: crypto.randomUUID(),
    public_id: "W09IMAGE1",
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: "商品图片",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "running",
    created_at: "2026-11-03T01:00:00.000Z",
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
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [imageJob] }) }),
  );
  await page.goto("/create");
  await expect(page.locator(".generation-job")).toHaveCount(1);
  const measurements = async () =>
    page.locator(".generation-job").evaluate((node) => {
      const list = node.parentElement;
      const meta = node.querySelector(".generation-meta");
      const prompt = node.querySelector(".generation-prompt");
      const action = node.querySelector(".history-icon-action");
      if (!list || !meta || !prompt || !action) throw new Error("Missing history geometry");
      return {
        topInset: Math.round(node.getBoundingClientRect().top - list.getBoundingClientRect().top),
        promptFont: getComputedStyle(prompt).fontSize,
        promptLine: getComputedStyle(prompt).lineHeight,
        metaFont: getComputedStyle(meta).fontSize,
        actionWidth: action.getBoundingClientRect().width,
        actionHeight: action.getBoundingClientRect().height,
      };
    });
  const image = await measurements();
  const imageDividerGaps = await page.locator(".generation-meta-units").evaluate((node) => {
    const previous = node.previousElementSibling;
    const values = node.querySelectorAll("dd");
    const inner = node.querySelector(".generation-meta-divider");
    if (!previous || !values[0] || !values[1] || !inner)
      throw new Error("Missing image parameters");
    const style = getComputedStyle(node, "::before");
    const left = node.getBoundingClientRect().left + Number.parseFloat(style.marginLeft);
    return {
      ratio: [
        Math.round(left - previous.getBoundingClientRect().right),
        Math.round(values[0].getBoundingClientRect().left - left - Number.parseFloat(style.width)),
      ],
      count: [
        Math.round(inner.getBoundingClientRect().left - values[0].getBoundingClientRect().right),
        Math.round(values[1].getBoundingClientRect().left - inner.getBoundingClientRect().right),
      ],
    };
  });
  expect(imageDividerGaps.ratio).toEqual(imageDividerGaps.count);
  expect(imageDividerGaps.ratio).toEqual([6, 6]);
  await expect(page.getByRole("button", { name: "复制提示词", exact: true })).toHaveCSS(
    "font-size",
    "11px",
  );
  let videoStatus = "succeeded";
  const posts: { body: unknown; key: string | undefined }[] = [];
  let release: (() => void) | undefined;
  await page.route("**/api/v1/video-model", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
  );
  await page.route("**/api/v1/video-tasks", async (route) => {
    if (route.request().method() === "POST") {
      posts.push({
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return route.fulfill({
        status: 202,
        json: apiFixture({ id: crypto.randomUUID(), replayed: false }),
      });
    }
    return route.fulfill({
      json: apiFixture({
        data: [
          {
            id,
            public_id: "WVIDEO1",
            prompt: input.prompt,
            status: videoStatus,
            created_at: imageJob.created_at,
            input: { video: input },
            error_code: null,
            asset_id: null,
            provider_status: null,
          },
        ],
      }),
    });
  });
  await page.goto("/video");
  const card = page.getByRole("article", { name: "视频任务：WVIDEO1" });
  await expect(card).toBeVisible();
  expect(await measurements()).toEqual(image);
  await expect(card.getByRole("button", { name: "复制提示词", exact: true })).toHaveCSS(
    "font-size",
    "11px",
  );
  const dividerGaps = await card.locator(".generation-meta-ratio ~ div").evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const previous = node.previousElementSibling;
      const text = node.querySelector("dd");
      if (
        !previous ||
        !text ||
        previous.getBoundingClientRect().top !== node.getBoundingClientRect().top
      )
        return [];
      const divider = getComputedStyle(node, "::before");
      const left = node.getBoundingClientRect().left + Number.parseFloat(divider.marginLeft);
      return [
        {
          before: Math.round(left - previous.getBoundingClientRect().right),
          after: Math.round(
            text.getBoundingClientRect().left - left - Number.parseFloat(divider.width),
          ),
        },
      ];
    }),
  );
  expect(dividerGaps.length).toBeGreaterThan(0);
  for (const gap of dividerGaps) expect(gap.before).toBe(gap.after);
  const draft = page.getByLabel("场景描述", { exact: true });
  await draft.fill("准备下一条视频的草稿");
  const regenerate = card.getByRole("button", { name: "重新生成", exact: true });
  await regenerate.click();
  const confirm = page.getByRole("dialog", { name: "重新生成这个视频？" });
  await expect(confirm).toContainText("本次消耗 100 积分");
  expect(posts).toHaveLength(0);
  await confirm.getByRole("button", { name: "确认", exact: true }).click();
  await expect.poll(() => posts.length).toBe(1);
  await expect(regenerate).toBeDisabled();
  await expect(page.locator(".video-composer .generation-submit")).toBeDisabled();
  release?.();
  await expect(regenerate).toBeEnabled();
  expect(posts[0]?.body).toEqual(input);
  expect(posts[0]?.key).toMatch(/^[a-f0-9-]{36}$/);
  await expect(draft).toHaveValue("准备下一条视频的草稿");
  for (const status of ["running", "needs_reconciliation"]) {
    videoStatus = status;
    await page.reload();
    await expect(card.getByRole("button", { name: "重新生成", exact: true })).toBeDisabled();
  }
  expect(posts).toHaveLength(1);
});
