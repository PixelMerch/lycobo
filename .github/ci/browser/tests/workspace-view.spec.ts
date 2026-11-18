import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

/** 两条任务：刚生成的单张图和两天前的四张图；图框尺寸只取决于任务记录里的宽高。 */
async function workspaceFixture(page: Page) {
  await mockImageApi(page);
  const now = new Date();
  const earlier = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 12);
  const job = (createdAt: Date, count: number) => {
    const input = {
      model: "gpt-image-2.5",
      prompt: "保留商品外形和面料纹理，更换为自然采光的卧室，不添加文字。",
      aspectRatio: "1:1",
      resolution: "1K",
      count,
      referenceAssetIds: [],
    };
    return {
      id: crypto.randomUUID(),
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      model: input.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      requested_count: count,
      created_at: createdAt.toISOString(),
      completed_at: createdAt.toISOString(),
      status: "succeeded",
      input,
      items: Array.from({ length: count }, (_, position) => ({
        id: crypto.randomUUID(),
        position,
        status: "succeeded",
        output_asset_id: crypto.randomUUID(),
        error_code: null,
        width: 1024,
        height: 1024,
        worker_id: "fixture-worker",
      })),
    };
  };
  const jobs = [job(now, 1), job(earlier, 4)];
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: jobs }) }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
}

test("desktop keeps the tools in a left rail beside the settings panel and stacked history cards", async ({
  page,
}) => {
  await workspaceFixture(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/commerce/create");
  await expect(page.locator(".generation-job")).toHaveCount(2);
  const dock = await page.locator(".workspace-tool-dock").boundingBox();
  const composer = await page.locator(".composer-panel").boundingBox();
  if (!dock || !composer) throw new Error("Workspace geometry missing");
  // 168px 竖排工具栏在最左侧，参数栏排在它右侧 12px 处；两者顶边与“生成记录”标题文字对齐。
  expect(dock.width).toBe(200);
  expect(dock.y).toBe(composer.y);
  const title = await page.getByRole("heading", { name: "生成记录", exact: true }).boundingBox();
  expect(Math.abs(composer.y - (title?.y ?? 0))).toBeLessThan(1);
  const firstCard = await page.locator(".generation-job").first().boundingBox();
  const firstThumb = await page.locator(".history-thumbnail").first().boundingBox();
  expect(Math.abs((firstCard?.y ?? 0) - (firstThumb?.y ?? 0))).toBeLessThan(1);
  expect(composer.x - (dock.x + dock.width)).toBe(12);
  await expect(
    page.getByRole("navigation", { name: "电商创作工具" }).getByRole("button"),
  ).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "生成记录", exact: true })).toBeVisible();
  // 任务卡保持上方信息、下方结果，单张结果高 320px。
  const first = page.locator(".generation-job").first();
  const prompt = await first.locator(".history-prompt").boundingBox();
  const result = await first.locator(".generation-results > div").first().boundingBox();
  if (!prompt || !result) throw new Error("History card geometry missing");
  expect(result.y).toBeGreaterThan(prompt.y + prompt.height);
  expect(result.height).toBeCloseTo(320, 0);
  // 模型下拉用共享毛玻璃（40px 背景模糊），后面的参数轨道不会透出来。
  await page.locator(".model-select").click();
  await expect(page.locator(".model-menu")).toHaveCSS("backdrop-filter", "blur(40px)");
  await page.keyboard.press("Escape");
  // 紧凑视图把行高降到 240px，刷新后保持。
  await page
    .getByRole("radiogroup", { name: "历史视图", exact: true })
    .getByRole("radio", { name: "紧凑", exact: true })
    .click();
  await expect(page.locator(".unified-workspace")).toHaveAttribute("data-density", "compact");
  await page.reload();
  const compact = await first.locator(".generation-results > div").first().boundingBox();
  expect(compact?.height).toBeCloseTo(240, 0);
});

test("the tool rail collapses to icons while the settings panel stays", async ({ page }) => {
  await workspaceFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const composer = page.locator(".composer-panel");
  const dock = page.locator(".workspace-tool-dock");
  const names = page.locator(".workspace-tool-dock .workspace-tool-label");
  const tools = page.getByRole("navigation", { name: "电商创作工具" });
  await expect(names.first()).toBeVisible();
  expect((await tools.getByRole("button").first().boundingBox())?.y).toBe(
    (await composer.boundingBox())?.y,
  );
  await page.getByRole("button", { name: "收起工具栏", exact: true }).click();
  // 收起后工具栏只剩 64px 宽的图标，按钮保留类别名，参数栏照常显示。
  await expect.poll(async () => (await dock.boundingBox())?.width).toBe(64);
  await expect(names.first()).toBeHidden();
  await expect(composer).toBeVisible();
  const expand = page.getByRole("button", { name: "展开工具栏", exact: true });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(expand).toBeFocused();
  await tools.getByRole("button", { name: "功能", exact: true }).click();
  const submenu = page.getByRole("menu", { name: "功能", exact: true });
  await expect(submenu.getByRole("menuitem", { name: "家纺裂变", exact: true })).toBeVisible();
  await expect(page.locator(".workspace-tool-submenu")).toHaveAttribute("data-placement", "right");
  await page.keyboard.press("Escape");
  // 刷新后保持收起，再点一次恢复名称。
  await page.reload();
  await expect.poll(async () => (await dock.boundingBox())?.width).toBe(64);
  await page.getByRole("button", { name: "展开工具栏", exact: true }).click();
  await expect(names.first()).toBeVisible();
  await expect.poll(async () => (await dock.boundingBox())?.width).toBe(200);
});

test("an image that cannot load shows a placeholder without preview, download or favorite", async ({
  page,
}) => {
  await workspaceFixture(page);
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const media = page.locator(".generation-job").first().locator(".generation-media").first();
  await expect(media.getByText("图片加载失败", { exact: true })).toBeVisible();
  await expect(media.getByRole("button", { name: "图片加载失败", exact: true })).toBeDisabled();
  await media.hover();
  await expect(media.getByRole("button", { name: "下载原图", exact: true })).toHaveCount(0);
  await expect(media.getByRole("button", { name: "收藏图片", exact: true })).toHaveCount(0);
  // 右侧缩略图同样不显示浏览器破图和替代文字。
  await expect(page.locator(".history-thumbnail-unavailable").first()).toBeVisible();
});
