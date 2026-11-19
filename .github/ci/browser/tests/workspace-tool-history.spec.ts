import { expect, test } from "@playwright/test";
import { apiFixture, chooseWorkspaceTool, mockImageApi } from "./image-api-fixture";

for (const width of [390, 1440]) {
  test(`workspace tools keep their own history and stay below the header at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const jobs = (tool: string) =>
      Array.from({ length: 4 }, (_, index) => ({
        id: crypto.randomUUID(),
        organization_id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        model: "gpt-image-2.5",
        prompt: `${tool}记录 ${index + 1}`,
        resolution: "1K",
        aspect_ratio: "1:1",
        requested_count: 1,
        status: "queued",
        created_at: "2026-10-20T01:00:00.000Z",
        completed_at: null,

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
      }));
    const createJobs = jobs("create"),
      textileJobs = jobs("textile");
    const requested: string[] = [];
    await page.route("**/api/v1/image-tasks?*", async (route) => {
      const tool = new URL(route.request().url()).searchParams.get("tool");
      requested.push(tool ?? "all");
      await route.fulfill({
        json: apiFixture({
          data: tool === "textile" ? textileJobs : tool === "variation" ? [] : createJobs,
        }),
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/create");
    const prompt = "保留商品主体，使用自然光。";
    if (width >= 768) {
      await page.getByRole("textbox", { name: "提示词", exact: true }).fill(prompt);
    }
    if (width < 768) await page.getByRole("radio", { name: "历史记录", exact: true }).click();
    await expect(page.getByRole("heading", { name: "历史记录", exact: true })).toHaveCount(0);
    await expect(page.locator(".generation-job")).toHaveCount(4);
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    // Switching controls never display help; the composer banner owns it.
    const textileShortcut = page
      .getByRole("navigation", { name: "电商创作工具" })
      .getByRole("button", { name: "品类工具", exact: true });
    await textileShortcut.hover();
    const preview = page.getByRole("tooltip");
    await expect(preview).toHaveCount(0);
    if (width >= 768) {
      const banner = page.locator(".workspace-composer-hero");
      await banner.hover();
      await expect(preview).toContainText("一张图讲清卖点");
      await expect(preview.getByRole("listitem")).toHaveCount(3);
      await expect(preview).not.toContainText("点击切换到此功能");
      const bannerBounds = await banner.boundingBox();
      const previewBounds = await preview.boundingBox();
      expect(previewBounds?.x).toBeGreaterThanOrEqual(
        (bannerBounds?.x ?? 0) + (bannerBounds?.width ?? 0),
      );
      await page.keyboard.press("Escape");
      await expect(preview).toHaveCount(0);
    }
    await expect(page).toHaveURL(/\/commerce\/create$/);
    await page.mouse.move(0, 0);
    const dock = page.getByRole("navigation", { name: "电商创作工具" });
    await expect(dock.getByRole("button")).toHaveCount(5);
    await expect(dock.getByRole("button", { name: "全部工具", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "选择工具" })).toHaveCount(0);
    if (width >= 1440) {
      expect(await dock.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await expect(page.locator(".generation-job")).toHaveCount(4);
    await expect(page.getByRole("combobox", { name: "历史工具筛选" })).toHaveCount(0);
    await expect(page.locator(".generation-history")).toContainText("create记录");
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect
      .poll(() =>
        // 桌面历史上方是“生成记录”标题行，窄屏是横排工具坞。
        page.evaluate(
          (selector) => {
            const toolbar = document.querySelector(selector);
            const header = document.querySelector(".workspace-site-header");
            return Math.abs(
              (toolbar?.getBoundingClientRect().top ?? 0) -
                (header?.getBoundingClientRect().bottom ?? 0) -
                12,
            );
          },
          width >= 1024 ? ".workspace-history-heading" : ".workspace-tool-dock",
        ),
      )
      .toBeLessThan(1);
    if (width >= 768) {
      const heading = await page.locator(".workspace-history-heading").boundingBox();
      const library = await page.locator(".history-rail-title").boundingBox();
      expect(heading).not.toBeNull();
      expect(library).not.toBeNull();
      expect(
        Math.abs(
          (heading?.y ?? 0) +
            (heading?.height ?? 0) / 2 -
            (library?.y ?? 0) -
            (library?.height ?? 0) / 2,
        ),
      ).toBeLessThan(1);
      await page.locator(".history-rail-item").nth(2).getByRole("button").first().click();
      const metaTop = await page
        .locator(".generation-job")
        .nth(2)
        .evaluate((el) => el.getBoundingClientRect().top);
      expect(metaTop).toBeGreaterThanOrEqual((heading?.y ?? 0) + (heading?.height ?? 0));
    }
    await page.screenshot({ path: `/tmp/lycobo-workspace-tools-${width}.png` });
    await chooseWorkspaceTool(page, "家纺裂变");
    await expect(page).toHaveURL(/textile-set/);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(page.locator(".unified-workspace")).toHaveAttribute("data-tool", "textile");
    await expect(page.locator(".workspace-composer-title")).toHaveText("家纺裂变");
    await expect(
      page.getByRole("navigation", { name: "电商创作工具" }).getByRole("button", {
        name: "品类工具",
        exact: true,
      }),
    ).toHaveAttribute("data-current", "true");
    await expect(page.locator(".composer-panel")).toContainText("详情图");
    await expect(page.locator(".composer-panel")).toContainText("裂变类型");
    // The panel hero follows the tool: its own example photo, name and purpose.
    const hero = page.locator(".workspace-composer-hero");
    await expect(hero).toHaveAttribute("data-tool", "textile");
    await expect(hero.locator(".workspace-composer-hero-collage img")).toHaveCount(5);
    await expect(hero.locator("img").first()).toHaveAttribute(
      "src",
      "/studio/textile-views/front.webp",
    );
    await expect(hero).toContainText("一张主图，延展多视角与细节图");
    await expect(page.locator(".generation-history")).toContainText("textile记录");
    await expect(page.locator(".generation-history")).not.toContainText("create记录");
    if (width >= 768) {
      await expect(page.locator(".history-rail-item")).toHaveCount(4);
      await expect(
        page.locator(".history-rail-item").first().getByRole("button").first(),
      ).toHaveAccessibleName(`查看任务 ${textileJobs[0]?.id}`);
    }
    await chooseWorkspaceTool(page, "套图计划");
    await expect(page.locator(".workspace-composer-title")).toHaveText("套图计划");
    await expect(page.locator(".unified-workspace")).toHaveAttribute("data-tool", "variation");
    await expect(page.locator(".generation-job")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "工作区历史记录" })).toContainText(
      "生成的图片会显示在这里",
    );
    expect(requested).not.toContain("all");
    expect(requested).not.toContain("null");
    if (width >= 768) {
      await expect(page.getByRole("textbox", { name: "创作需求" })).toBeVisible();
      await chooseWorkspaceTool(page, "主图制作");
      await expect(page.locator(".workspace-composer-title")).toHaveText("主图制作");
      await expect(page.getByRole("textbox", { name: "提示词", exact: true })).toHaveValue(prompt);
    }
  });
}
