import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("one video action runs all stages and reuses a lost submission", async ({ page }) => {
  await mockImageApi(page);
  const original = crypto.randomUUID();
  const planId = crypto.randomUUID();
  const videoId = crypto.randomUUID();
  const items = ["绗缝特写", "卧室全景", "商品定格"].map((title) => ({
    id: crypto.randomUUID(),
    title,
    prompt: `以商品原图为准，展示${title}。`,
  }));
  const images = items.map(() => crypto.randomUUID());
  let imagesReady = false;
  let partialFrameReady = false;
  let allowOptimization: (() => void) | undefined;
  let completed: object | null = null;
  const imageRequests: unknown[] = [];
  const planningRequests: unknown[] = [];
  const videoRequests: unknown[] = [];
  const videoKeys: (string | undefined)[] = [];
  const jobs = new Map<string, string[]>();
  const description = "晨光卧室，保留奶油色菱格绗缝";
  const plan = {
    id: planId,
    status: "ready",
    description,
    referenceAssetIds: [original],
    items,
  };
  await page.route("**/api/v1/video-storyboards/capabilities", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true }) }),
  );
  await page.route("**/api/v1/video-model", (route) =>
    route.fulfill({
      json: apiFixture({
        enabled: true,
        storyboardHistory: true,
        resolution: "768p",
        unitCredits: 100,
      }),
    }),
  );
  await page.route("**/api/v1/image-assets", (route) =>
    route.fulfill({
      json: apiFixture({ id: original, width: 2, height: 2, bytes: 100, mimeType: "image/png" }),
    }),
  );
  await page.route("**/api/v1/image-assets/*/content*", (route) =>
    route.fulfill({
      path: "apps/web/public/studio/textile-views/front.webp",
      contentType: "image/webp",
    }),
  );
  await page.route("**/api/v1/video-storyboards", async (route) => {
    const input = route.request().postDataJSON();
    planningRequests.push(input);
    if (input.stage === "video")
      await new Promise<void>((resolve) => {
        allowOptimization = resolve;
      });
    return route.fulfill({
      json: apiFixture(
        input.stage === "plan"
          ? plan
          : {
              ...plan,
              id: crypto.randomUUID(),
              items: [
                { id: crypto.randomUUID(), title: "成片", prompt: "先全景，随后特写和定格。" },
              ],
            },
      ),
    });
  });
  await page.route(`**/api/v1/variation-plans/${planId}`, (route) =>
    route.fulfill({ json: apiFixture(plan) }),
  );
  await page.route("**/api/v1/image-tasks", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: apiFixture({ data: [] }) });
    const input = route.request().postDataJSON();
    imageRequests.push(input);
    const id = crypto.randomUUID();
    jobs.set(id, images);
    return route.fulfill({ status: 202, json: apiFixture({ id, replayed: false }) });
  });
  await page.route("**/api/v1/image-tasks/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    const outputs = jobs.get(id) ?? [];
    return route.fulfill({
      json: apiFixture({
        id,
        organization_id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        model: "gpt-image-2.5",
        prompt: description,
        resolution: "1.5K",
        aspect_ratio: "9:16",
        requested_count: outputs.length,
        status: imagesReady ? "succeeded" : "running",
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        items: outputs.map((output_asset_id, position) => {
          const ready = imagesReady || (partialFrameReady && position === 1);
          return {
            id: crypto.randomUUID(),
            position,
            status: ready ? "succeeded" : "running",
            output_asset_id: ready ? output_asset_id : null,
            error_code: null,
            width: 768,
            height: 1360,
            worker_id: null,
          };
        }),
      }),
    });
  });
  await page.route("**/api/v1/video-tasks", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: apiFixture({ data: completed ? [completed] : [] }) });
    const submission = route.request().postDataJSON();
    videoRequests.push(submission);
    videoKeys.push(route.request().headers()["idempotency-key"]);
    if (videoRequests.length === 1) return route.abort("failed");
    const { storyboard, ...video } = submission;
    completed = {
      id: videoId,
      public_id: "W09VIDEO1",
      prompt: "先全景，随后特写和定格。",
      status: "succeeded",
      created_at: new Date().toISOString(),
      input: { video, storyboard },
      error_code: null,
      asset_id: original,
      provider_status: "completed",
      delivery: {
        url: "http://127.0.0.1:5173/fixture-video.mp4",
        download_url: "http://127.0.0.1:5173/fixture-video.mp4",
      },
    };
    return route.fulfill({ status: 202, json: apiFixture({ id: videoId, replayed: false }) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/video");
  const composer = page.getByRole("region", { name: "视频创作参数" });
  await expect(page.getByRole("radio", { name: "直接生成" })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "TK 分镜创作" })).toHaveCount(0);
  await composer.getByLabel("添加参考图片").setInputFiles({
    name: "product.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await composer.getByRole("textbox", { name: "场景描述" }).fill(description);
  await expect(composer).toContainText("预计 106 积分");
  await composer.getByRole("button", { name: /立即生成.*106/ }).click();
  const progress = page.getByRole("region", { name: "视频制作进度" });
  await expect(progress.getByRole("listitem").nth(0)).toContainText("进行中");
  await expect(progress.getByRole("listitem").nth(1)).toContainText("等待中");
  await expect.poll(() => imageRequests.length).toBe(1);
  expect(videoRequests).toHaveLength(0);
  expect(planningRequests[0]).toEqual({
    stage: "plan",
    description,
    originalAssetId: original,
    count: 3,
    seconds: 10,
  });
  expect(imageRequests[0]).toEqual(
    expect.objectContaining({
      model: "gpt-image-2.5",
      count: 3,
      aspectRatio: "9:16",
      referenceAssetIds: [original],
    }),
  );

  const frames = progress.getByRole("region", { name: "分镜画面" });
  partialFrameReady = true;
  await expect(frames.getByRole("img", { name: "卧室全景" })).toBeVisible();
  await expect(frames.getByRole("img")).toHaveCount(1);
  await expect(progress.getByRole("listitem").nth(0)).toContainText("进行中");
  imagesReady = true;
  await expect(progress.getByRole("listitem").nth(0)).toContainText("已完成");
  await expect(progress.getByRole("listitem").nth(1)).toContainText("进行中");
  expect(
    await frames
      .getByRole("img")
      .evaluateAll((images) => images.map((image) => image.getAttribute("alt"))),
  ).toEqual(items.map(({ title }) => title));
  expect(videoRequests).toHaveLength(0);
  expect(planningRequests[1]).toEqual(
    expect.objectContaining({
      stage: "video",
      originalAssetId: original,
      shots: images.map((assetId) => expect.objectContaining({ assetId })),
    }),
  );
  allowOptimization?.();
  await expect.poll(() => videoRequests.length).toBe(1);
  await expect(progress.getByRole("listitem").nth(2)).toContainText("待继续");
  await expect(progress).toContainText(items.map(({ title }) => title).join(" → "));
  const videoSlot = progress.locator(".video-production-media");
  await expect(videoSlot).toBeVisible();
  await page.reload();
  await expect(frames.getByRole("img")).toHaveCount(3);
  await composer.getByRole("button", { name: /确认上次提交.*100/ }).click();
  await expect.poll(() => videoRequests.length).toBe(2);
  expect(videoRequests[0]).toEqual({
    prompt: "先全景，随后特写和定格。",
    seconds: 10,
    aspectRatio: "9:16",
    referenceAssetIds: [original, ...images],
    storyboard: { description },
  });
  expect(videoRequests[1]).toEqual(videoRequests[0]);
  expect(videoKeys[0]).toMatch(/^[a-f0-9-]{36}$/);
  expect(videoKeys[1]).toBe(videoKeys[0]);
  expect(imageRequests).toHaveLength(1);
  expect(planningRequests).toHaveLength(2);
  const history = page.getByRole("article", { name: "视频任务：W09VIDEO1" });
  await expect(progress).toHaveCount(0);
  await expect(history.getByRole("button", { name: "预览视频：W09VIDEO1" })).toBeVisible();
  await expect(history.getByRole("link", { name: "下载视频" })).toBeVisible();
  await page.reload();
  await expect(history.getByText(description, { exact: true })).toBeVisible();
  const aiContent = history.getByRole("button", { name: "AI 生成内容" });
  const aiDescription = history.getByText("先全景，随后特写和定格。", { exact: true });
  const originalThumbs = history.getByRole("region", { name: "视频参考图" }).getByRole("img");
  const storyboardThumbs = history.getByRole("region", { name: "分镜图片" }).getByRole("img");
  await expect(history.getByRole("button", { name: "复制提示词", exact: true })).toBeVisible();
  await expect(originalThumbs).toHaveCount(1);
  await expect(aiContent).toHaveAttribute("aria-expanded", "false");
  await expect(aiDescription).toBeHidden();
  await expect(storyboardThumbs).toHaveCount(0);
  await aiContent.focus();
  await aiContent.press("Enter");
  await expect(aiContent).toHaveAttribute("aria-expanded", "true");
  await expect(aiDescription).toBeVisible();
  await expect(history.getByRole("button", { name: "复制 AI 描述" })).toBeVisible();
  await expect(storyboardThumbs).toHaveCount(3);
  expect(
    await storyboardThumbs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src"))),
  ).toEqual(images.map((id) => `/api/v1/image-assets/${id}/content?thumbnail=1`));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("radio", { name: "历史记录", exact: true }).click();
  await expect.poll(() => history.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await aiContent.click();
  await expect(aiContent).toHaveAttribute("aria-expanded", "false");
  await expect(aiDescription).toBeHidden();
  await expect(originalThumbs).toHaveCount(1);
});
