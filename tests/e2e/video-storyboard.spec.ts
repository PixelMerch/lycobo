import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("TK 分镜 separates image and video submissions, saves order and redraws only one shot", async ({
  page,
}) => {
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
  const replacement = crypto.randomUUID();
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
    route.fulfill({ json: apiFixture({ enabled: true, resolution: "768p", unitCredits: 100 }) }),
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
  await page.route("**/api/v1/video-storyboards", (route) => {
    const input = route.request().postDataJSON();
    planningRequests.push(input);
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
    jobs.set(id, input.count === 3 ? images : [replacement]);
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
        status: "succeeded",
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        items: outputs.map((output_asset_id, position) => ({
          id: crypto.randomUUID(),
          position,
          status: "succeeded",
          output_asset_id,
          error_code: null,
          width: 768,
          height: 1360,
          worker_id: null,
        })),
      }),
    });
  });
  await page.route("**/api/v1/video-tasks", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: apiFixture({ data: [] }) });
    videoRequests.push(route.request().postDataJSON());
    videoKeys.push(route.request().headers()["idempotency-key"]);
    if (videoRequests.length === 1) return route.abort("failed");
    return route.fulfill({ status: 202, json: apiFixture({ id: videoId, replayed: false }) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/video");
  await page.getByRole("textbox", { name: "场景描述" }).fill("保留直接生成草稿");
  await page.getByRole("radio", { name: "TK 分镜创作" }).click();
  const composer = page.getByRole("region", { name: "TK 分镜创作参数" });
  await expect(composer.getByRole("textbox", { name: "分镜图张数" })).toHaveValue("3");
  await expect(composer.getByRole("slider")).toHaveValue("10");
  const draw = composer.getByRole("button", { name: /生成分镜.*6/ });
  await expect(draw).toBeDisabled();
  await composer.getByLabel("添加参考图片").setInputFiles({
    name: "product.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await composer.getByRole("textbox", { name: "场景描述" }).fill(description);
  await draw.click();
  const panel = page.getByRole("region", { name: "分镜工作区" });
  const shots = panel.getByRole("list", { name: "分镜顺序" });
  await expect(shots.getByRole("img")).toHaveCount(3);
  expect(planningRequests[0]).toEqual({
    stage: "plan",
    description,
    originalAssetId: original,
    count: 3,
    seconds: 10,
  });
  expect(imageRequests).toEqual([
    expect.objectContaining({
      model: "gpt-image-2.5",
      count: 3,
      aspectRatio: "9:16",
      referenceAssetIds: [original],
    }),
  ]);
  expect(videoRequests).toHaveLength(0);
  await page.screenshot({ path: "/tmp/lycobo-tk-storyboard-desktop.png" });

  await panel.getByRole("button", { name: "前移第 2 张" }).click();
  await expect(shots.getByRole("listitem").first()).toContainText("卧室全景");
  await panel.getByRole("button", { name: /重做第 1 张/ }).click();
  await page
    .getByRole("dialog", { name: "重做这张分镜图？" })
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect(shots.getByRole("img").first()).toHaveAttribute("src", new RegExp(replacement));
  expect(imageRequests[1]).toEqual(
    expect.objectContaining({
      count: 1,
      variation: expect.objectContaining({ items: [items[1]] }),
    }),
  );

  await page.getByRole("radio", { name: "直接生成" }).click();
  await expect(page.getByRole("textbox", { name: "场景描述" })).toHaveValue("保留直接生成草稿");
  await page.getByRole("radio", { name: "TK 分镜创作" }).click();
  await expect(shots.getByRole("listitem").first()).toContainText("卧室全景");
  await panel.getByRole("button", { name: /生成视频.*100/ }).click();
  expect(videoRequests).toHaveLength(0);
  await page
    .getByRole("dialog", { name: "按当前分镜生成视频？" })
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect.poll(() => videoRequests.length).toBe(1);
  expect(planningRequests[1]).toEqual(
    expect.objectContaining({
      stage: "video",
      originalAssetId: original,
      shots: [replacement, images[0], images[2]].map((assetId) =>
        expect.objectContaining({ assetId }),
      ),
    }),
  );
  expect(videoRequests[0]).toEqual({
    prompt: "先全景，随后特写和定格。",
    seconds: 10,
    aspectRatio: "9:16",
    referenceAssetIds: [original, replacement, images[0], images[2]],
  });
  const resume = panel.getByRole("button", { name: /确认上次视频提交/ });
  await expect(resume).toBeEnabled();
  await page.getByRole("radio", { name: "直接生成" }).click();
  await expect(page.getByText("请切换到 TK 分镜创作确认上次视频提交。")).toBeVisible();
  await page.getByRole("radio", { name: "TK 分镜创作" }).click();
  await resume.click();
  await expect.poll(() => videoRequests.length).toBe(2);
  expect(videoRequests[1]).toEqual(videoRequests[0]);
  expect(videoKeys[0]).toMatch(/^[a-f0-9-]{36}$/);
  expect(videoKeys[1]).toBe(videoKeys[0]);
  expect(planningRequests).toHaveLength(2);
  await expect(page.getByRole("region", { name: "工作区历史记录" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("radio", { name: "创作", exact: true }).click();
  await composer.getByRole("button", { name: "查看分镜" }).click();
  await expect(panel).toBeVisible();
  await expect(shots.getByRole("listitem").first()).toContainText("卧室全景");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/lycobo-tk-storyboard-mobile.png" });
});
