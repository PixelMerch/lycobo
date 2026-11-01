import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

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
    await page.goto("/create");
    const prompt = "保留商品主体，使用自然光。";
    if (width >= 768) {
      await page.getByRole("textbox", { name: "提示词", exact: true }).fill(prompt);
    }
    if (width < 768) await page.getByRole("radio", { name: "历史记录", exact: true }).click();
    await expect(page.getByRole("heading", { name: "历史记录", exact: true })).toHaveCount(0);
    await expect(page.locator(".generation-job")).toHaveCount(4);
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    // Hovering a tool previews what it does and how to use it, without switching tools.
    await page
      .getByRole("navigation", { name: "电商创作工具" })
      .getByRole("button", { name: "家纺套图", exact: true })
      .hover();
    const preview = page.getByRole("tooltip");
    await expect(preview).toContainText("上传主图，选择视角，一次生成整套");
    await expect(preview.getByRole("listitem")).toHaveCount(3);
    await expect(preview).toContainText("点击切换到此功能");
    await expect(page).toHaveURL(/\/create$/);
    await page.mouse.move(0, 0);
    await expect(preview).toHaveCount(0);
    const allTools = page.getByRole("button", { name: "全部工具", exact: true });
    // The dock names every entry on screen, so hovering adds no tooltip.
    await expect(allTools).toContainText("视频即将开放");
    await allTools.hover();
    await page.screenshot({ path: `/tmp/lycobo-tabs-hover-${width}.png` });
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await allTools.click();
    await expect(page.getByRole("dialog", { name: "选择工具" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(allTools).toBeFocused();
    await expect(page.locator(".generation-job")).toHaveCount(4);
    await expect(page.getByRole("combobox", { name: "历史工具筛选" })).toHaveCount(0);
    await expect(page.locator(".generation-history")).toContainText("create记录");
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const toolbar = document.querySelector(".workspace-history-heading");
          const header = document.querySelector(".topbar");
          return Math.abs(
            (toolbar?.getBoundingClientRect().top ?? 0) -
              (header?.getBoundingClientRect().bottom ?? 0) -
              12,
          );
        }),
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
    await page
      .getByRole("navigation", { name: "电商创作工具" })
      .getByRole("button", { name: "家纺套图", exact: true })
      .click();
    await expect(page).toHaveURL(/textile-set/);
    await expect(page.locator(".unified-workspace")).toHaveAttribute("data-tool", "textile");
    await expect(page.locator(".workspace-composer-title")).toHaveText("家纺套图");
    await expect(
      page.getByRole("navigation", { name: "电商创作工具" }).getByRole("button", {
        name: "家纺套图",
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".composer-panel")).toContainText("详情图");
    await expect(page.locator(".composer-panel")).toContainText("裂变类型");
    // The panel hero follows the tool: its own example photo, name and purpose.
    const hero = page.locator(".workspace-composer-hero");
    await expect(hero).toHaveAttribute("data-tool", "textile");
    await expect(hero.locator("img")).toHaveAttribute("src", "/studio/tool-heroes/textile.webp");
    await expect(hero).toContainText("上传主图，选择视角，一次生成整套");
    await expect(page.locator(".generation-history")).toContainText("textile记录");
    await expect(page.locator(".generation-history")).not.toContainText("create记录");
    if (width >= 768) {
      await expect(page.locator(".history-rail-item")).toHaveCount(4);
      await expect(
        page.locator(".history-rail-item").first().getByRole("button").first(),
      ).toHaveAccessibleName(`查看任务 ${textileJobs[0]?.id}`);
    }
    await page
      .getByRole("navigation", { name: "电商创作工具" })
      .getByRole("button", { name: "智能裂变", exact: true })
      .click();
    await expect(page.locator(".workspace-composer-title")).toHaveText("智能裂变");
    await expect(page.locator(".unified-workspace")).toHaveAttribute("data-tool", "variation");
    await expect(page.locator(".generation-job")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "工作区历史记录" })).toContainText(
      "生成的图片会显示在这里",
    );
    expect(requested).not.toContain("all");
    expect(requested).not.toContain("null");
    if (width >= 768) {
      await expect(page.getByRole("textbox", { name: "创作需求" })).toBeVisible();
      await page
        .getByRole("navigation", { name: "电商创作工具" })
        .getByRole("button", { name: "主图制作", exact: true })
        .click();
      await expect(page.locator(".workspace-composer-title")).toHaveText("主图制作");
      await expect(page.getByRole("textbox", { name: "提示词", exact: true })).toHaveValue(prompt);
    }
  });
}
