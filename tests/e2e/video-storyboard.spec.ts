import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("one video action runs all stages and confirms a lost submission", async ({ page }) => {
  await verifyStoryboard(page, 1);
});

for (const legacy of [false, true]) {
  test(`video waits for a failed frame to be retried (${legacy ? "legacy draft" : "new draft"})`, async ({
    page,
  }) => {
    await verifyStoryboard(page, 3, legacy);
  });
}

async function verifyStoryboard(page: Page, originalCount: number, legacy = false) {
  await mockImageApi(page);
  const original = crypto.randomUUID();
  const additionalOriginalAssetIds = Array.from({ length: originalCount - 1 }, () =>
    crypto.randomUUID(),
  );
  const originals = [original, ...additionalOriginalAssetIds];
  const storyboardOriginals = originalCount > 1 ? { additionalOriginalAssetIds } : {};
  let uploaded = 0;
  const planId = crypto.randomUUID();
  const videoId = crypto.randomUUID();
  const items = ["绗缝特写", "卧室全景", "商品定格"].map((title) => ({
    id: crypto.randomUUID(),
    title,
    prompt: `以商品原图为准，展示${title}。`,
  }));
  const images = items.map(() => crypto.randomUUID());
  const losesFirstFrame = originalCount === 3;
  const completedImages = images;
  const completedTitles = items.map(({ title }) => title);
  const jobItemIds = items.map(() => crypto.randomUUID());
  const legacyKey = crypto.randomUUID();
  let firstFrameRetried = false;
  const imageRetries: unknown[] = [];
  let imagesReady = false;
  let referenceImagesEnabled = true;
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
    referenceAssetIds: originals,
    items,
  };
  await page.route("**/api/v1/video-storyboards/capabilities", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true, maxStoryboardOriginalImages: 3 }) }),
  );
  await page.route("**/api/v1/video-model", (route) =>
    route.fulfill({
      json: apiFixture({
        enabled: true,
        storyboardHistory: true,
        referenceImagesEnabled,
        maxStoryboardOriginalImages: 3,
        resolution: "768p",
        unitCredits: 100,
      }),
    }),
  );
  await page.route("**/api/v1/image-assets", (route) =>
    route.fulfill({
      json: apiFixture({
        id: originals[uploaded++],
        width: 2,
        height: 2,
        bytes: 100,
        mimeType: "image/webp",
      }),
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
  await page.route("**/api/v1/image-tasks/*/retry", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    expect(jobs.has(id)).toBe(true);
    imageRetries.push(route.request().postDataJSON());
    firstFrameRetried = true;
    return route.fulfill({ status: 202, json: apiFixture({ id, replayed: false }) });
  });
  await page.route("**/api/v1/image-tasks/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    const outputs = jobs.get(id) ?? [];
    const partial = losesFirstFrame && !firstFrameRetried;
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
        status: imagesReady ? (partial ? "partially_failed" : "succeeded") : "running",
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        items: outputs.map((output_asset_id, position) => {
          const failed = imagesReady && partial && position === 0;
          const ready = (imagesReady && !failed) || (partialFrameReady && position === 1);
          return {
            id: jobItemIds[position],
            position,
            status: failed ? "failed" : ready ? "succeeded" : "running",
            output_asset_id: ready ? output_asset_id : null,
            error_code: failed ? "PROVIDER_TASK_FAILED" : null,
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
    if (videoRequests.length === 1) {
      if (!losesFirstFrame) return route.abort("failed");
      referenceImagesEnabled = false;
      return route.fulfill({
        status: 503,
        json: {
          ...apiFixture({}, 503),
          code: 40003,
          message: "当前环境无法向视频服务提供参考图。",
          error: { code: "VIDEO_REFERENCES_UNAVAILABLE" },
        },
      });
    }
    const { storyboard, storyboardOriginalImageCount, ...video } = submission;
    completed = {
      id: videoId,
      public_id: "W09VIDEO1",
      prompt: "先全景，随后特写和定格。",
      status: "succeeded",
      created_at: new Date().toISOString(),
      input: { video, storyboard, storyboardOriginalImageCount },
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
  await expect(composer).toContainText("最多上传3张参考图");
  await composer
    .getByLabel("添加参考图片")
    .setInputFiles(
      ["front.webp", "close-up.webp", "overhead-wide.webp"]
        .slice(0, originalCount)
        .map((name) => `apps/web/public/studio/textile-views/${name}`),
    );
  await expect(composer.locator(".reference-image-card")).toHaveCount(originalCount);
  if (originalCount === 3) {
    await expect(composer.getByLabel("添加参考图片")).toBeDisabled();
    await expect(composer.getByText("第 1 张为主图，其余为补充参考。")).toBeVisible();
  }
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
    ...storyboardOriginals,
    count: 3,
    seconds: 10,
  });
  expect(imageRequests[0]).toEqual(
    expect.objectContaining({
      model: "gpt-image-2.5",
      count: 3,
      aspectRatio: "9:16",
      referenceAssetIds: originals,
    }),
  );

  const frames = progress.getByRole("region", { name: "分镜画面" });
  partialFrameReady = true;
  await expect(frames.getByRole("img", { name: "卧室全景" })).toBeVisible();
  await expect(frames.getByRole("img")).toHaveCount(1);
  await expect(composer.getByRole("textbox", { name: "场景描述" })).toBeEmpty({
    timeout: 1500,
  });
  await expect(composer.locator(".reference-image-card")).toHaveCount(0);
  const nextDescription = "下一条视频的草稿";
  const descriptionInput = composer.getByRole("textbox", { name: "场景描述" });
  if (!losesFirstFrame) await descriptionInput.fill(nextDescription);
  await expect(progress.getByRole("listitem").nth(0)).toContainText("进行中");
  imagesReady = true;
  if (losesFirstFrame) {
    const retryFrame = progress.getByRole("button", { name: /重试第 1 张分镜/ });
    await expect(progress.getByRole("listitem").nth(0)).toContainText("待补齐");
    await expect(progress).toContainText("已生成 2/3 张分镜");
    await expect(composer.getByRole("button", { name: /立即生成/ })).toBeDisabled();
    await expect(descriptionInput).toBeEditable();
    await expect(progress.getByRole("listitem").nth(1)).toContainText("等待中");
    await expect(progress.getByRole("listitem").nth(2)).toContainText("等待中");
    expect(planningRequests).toHaveLength(1);
    expect(videoRequests).toHaveLength(0);
    if (legacy) {
      await page.evaluate(
        ({ legacyKey, originals, partialShots, description }) => {
          const draftKey = Object.keys(sessionStorage).find((key) =>
            key.startsWith("lycobo-tk-storyboard:"),
          );
          if (!draftKey) throw new Error("分镜草稿未保存");
          const draft = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
          const [originalAssetId, ...additionalOriginalAssetIds] = originals;
          const prompt = "旧版只用了两张分镜。";
          draft.progress.optimization = {
            key: crypto.randomUUID(),
            input: {
              stage: "video",
              description,
              originalAssetId,
              additionalOriginalAssetIds,
              seconds: 10,
              shots: partialShots,
            },
            prompt,
          };
          delete draft.progress.failedFramePositions;
          sessionStorage.setItem(draftKey, JSON.stringify(draft));
          sessionStorage.setItem(
            draftKey.replace("lycobo-tk-storyboard:", "lycobo-pending-video:"),
            JSON.stringify({
              key: legacyKey,
              source: "storyboard",
              input: {
                prompt,
                seconds: 10,
                aspectRatio: "9:16",
                referenceAssetIds: [...originals, ...partialShots.map(({ assetId }) => assetId)],
                storyboard: { description },
                storyboardOriginalImageCount: originals.length,
              },
            }),
          );
        },
        {
          legacyKey,
          originals,
          description,
          partialShots: items
            .slice(1)
            .map(({ title, prompt }, i) => ({ assetId: images[i + 1], title, prompt })),
        },
      );
      await page.reload();
      await expect(progress.getByRole("listitem").nth(1)).toContainText("等待中");
      await expect(progress.getByRole("listitem").nth(2)).toContainText("等待中");
    }
    await expect(progress.getByRole("button", { name: /重试第 .* 张分镜/ })).toHaveCount(1);
    await retryFrame.click();
    await expect.poll(() => imageRetries).toEqual([{ itemId: jobItemIds[0] }]);
  }
  await expect(progress.getByRole("listitem").nth(0)).toContainText("已完成");
  await expect(progress.getByRole("listitem").nth(1)).toContainText("进行中");
  expect(
    await frames
      .getByRole("img")
      .evaluateAll((images) => images.map((image) => image.getAttribute("alt"))),
  ).toEqual(completedTitles);
  expect(videoRequests).toHaveLength(0);
  expect(planningRequests[1]).toEqual(
    expect.objectContaining({
      stage: "video",
      originalAssetId: original,
      ...storyboardOriginals,
      shots: completedImages.map((assetId) => expect.objectContaining({ assetId })),
    }),
  );
  allowOptimization?.();
  await expect.poll(() => videoRequests.length).toBe(1);
  await expect(progress.getByRole("listitem").nth(2)).toContainText(
    losesFirstFrame && !legacy ? "待继续" : "待确认",
  );
  await expect(progress).toContainText(completedTitles.join(" → "));
  await expect(descriptionInput).toBeEditable();
  if (losesFirstFrame) {
    await expect(
      page.getByText("当前环境无法向视频服务提供参考图。", { exact: true }),
    ).toBeVisible();
    await expect(progress).not.toContainText("当前环境无法向视频服务提供参考图");
    await expect(
      progress.getByRole("button", { name: /(?:继续生成|确认上次提交).*100/ }),
    ).toBeDisabled();
    expect(videoRequests).toHaveLength(1);
    referenceImagesEnabled = true;
  }
  await expect(composer).not.toContainText("上一条视频可在历史记录中继续");
  const videoSlot = progress.locator(".video-production-media");
  await expect(videoSlot).toBeVisible();
  if (originalCount === 3) await page.reload();
  await expect(frames.getByRole("img")).toHaveCount(completedImages.length);
  await expect(composer.locator(".reference-image-card")).toHaveCount(0);
  await progress
    .getByRole("button", {
      name: losesFirstFrame && !legacy ? /继续生成.*100/ : /确认上次提交.*100/,
    })
    .click();
  await expect.poll(() => videoRequests.length).toBe(2);
  expect(videoRequests[0]).toEqual({
    prompt: "先全景，随后特写和定格。",
    seconds: 10,
    aspectRatio: "9:16",
    referenceAssetIds: [...originals, ...completedImages],
    storyboard: { description },
    ...(originalCount > 1 ? { storyboardOriginalImageCount: originalCount } : {}),
  });
  expect(videoRequests[1]).toEqual(videoRequests[0]);
  expect(videoKeys[0]).toMatch(/^[a-f0-9-]{36}$/);
  if (legacy) expect(videoKeys).toEqual([legacyKey, legacyKey]);
  else if (losesFirstFrame) expect(videoKeys[1]).not.toBe(videoKeys[0]);
  else expect(videoKeys[1]).toBe(videoKeys[0]);
  expect(imageRequests).toHaveLength(1);
  expect(planningRequests).toHaveLength(2);
  const history = page.getByRole("article", { name: "视频任务：W09VIDEO1" });
  await expect(progress).toHaveCount(0);
  if (losesFirstFrame) await expect(descriptionInput).toBeEmpty();
  else {
    await expect(descriptionInput).toHaveText(nextDescription);
    await expect(composer.getByRole("button", { name: /立即生成.*100/ })).toBeEnabled();
  }
  await expect(composer.locator(".reference-image-card")).toHaveCount(0);
  await expect(history.getByRole("button", { name: "预览视频：W09VIDEO1" })).toBeVisible();
  await expect(history.getByRole("link", { name: "下载视频" })).toBeVisible();
  await page.reload();
  await expect(history.getByText(description, { exact: true })).toBeVisible();
  const aiContent = history.getByRole("button", { name: "AI 生成内容" });
  const aiDescription = history.getByText("先全景，随后特写和定格。", { exact: true });
  const originalThumbs = history.getByRole("region", { name: "视频参考图" }).getByRole("img");
  const storyboardThumbs = history.getByRole("region", { name: "分镜图片" }).getByRole("img");
  await expect(history.getByRole("button", { name: "复制提示词", exact: true })).toBeVisible();
  await expect(originalThumbs).toHaveCount(originalCount);
  await expect(aiContent).toHaveAttribute("aria-expanded", "false");
  await expect(aiDescription).toBeHidden();
  await expect(storyboardThumbs).toHaveCount(0);
  await aiContent.focus();
  await aiContent.press("Enter");
  await expect(aiContent).toHaveAttribute("aria-expanded", "true");
  await expect(aiDescription).toBeVisible();
  await expect(history.getByRole("button", { name: "复制 AI 描述" })).toBeVisible();
  await expect(storyboardThumbs).toHaveCount(completedImages.length);
  expect(
    await storyboardThumbs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src"))),
  ).toEqual(completedImages.map((id) => `/api/v1/image-assets/${id}/content?thumbnail=1`));
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("radio", { name: "历史记录", exact: true }).click();
  await expect.poll(() => history.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await aiContent.click();
  await expect(aiContent).toHaveAttribute("aria-expanded", "false");
  await expect(aiDescription).toBeHidden();
  await expect(originalThumbs).toHaveCount(originalCount);
}
