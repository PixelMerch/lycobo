import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { apiFixture, chooseWorkspaceTool, mockImageApi } from "./image-api-fixture";

const png = readFileSync(new URL("../fixtures/studio/textile-views/front.webp", import.meta.url));

test("tool menu opens on click and drafts survive switching", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/zh-CN/commerce/create");
  const prompt = page.locator("textarea").first();
  await prompt.fill("保留当前商品草稿");
  const rail = page.getByRole("navigation", { name: "电商创作工具", exact: true });
  await expect(rail.getByRole("button", { name: "商品视频" })).toHaveCount(0);
  const trigger = rail.getByRole("button", { name: "商品图片", exact: true });
  const menu = page.getByRole("menu", { name: "商品图片", exact: true });
  const arrow = trigger.locator(".workspace-tool-chevron .ui-icon");
  const preview = page.locator(".workspace-tool-preview-card");
  await trigger.hover();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveCount(0);
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
  await expect(page.locator(".composer-scroll")).toHaveCSS("overflow-y", "hidden");
  await expect(menu).toHaveCSS("overflow-y", "auto");
  await expect(arrow).toHaveCSS("transform", "matrix(-1, 0, 0, -1, 0, 0)");
  await page.mouse.move(0, 0);
  await expect(menu).toBeVisible();
  const banner = page.locator(".workspace-composer-hero");
  await expect(banner.locator("img")).toHaveCount(1);
  const bannerImage = banner.getByRole("img", { name: /橙色跑鞋/ });
  await expect(bannerImage).toBeVisible();
  const thumbnail = page.getByRole("menuitem", { name: "商品主图", exact: true }).locator("img");
  await expect(thumbnail).toHaveAttribute("src", (await bannerImage.getAttribute("src")) ?? "");
  await expect(thumbnail).toHaveCSS("width", "72px");
  await expect(thumbnail).toHaveCSS("height", "50px");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveCount(0);
  await expect(arrow).toHaveCSS("transform", "none");
  await trigger.click();
  await page.getByRole("button", { name: "关闭工具菜单", exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
  await expect(trigger).toBeFocused();
  await banner.hover();
  await expect(preview).toHaveCount(0);
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(prompt).toHaveValue("保留当前商品草稿");
  await page.keyboard.press("Escape");
  await chooseWorkspaceTool(page, "复制爆款");
  await expect(page).toHaveURL(/\/commerce\/replica$/);
  await chooseWorkspaceTool(page, "主图制作");
  await expect(prompt).toHaveValue("保留当前商品草稿");
});

test("style matching requires both slots and submits their roles without a paid provider", async ({
  page,
}) => {
  await mockImageApi(page);
  let submitted: unknown;
  // 只返回已持久化的上传票据，浏览器不能等待处理状态才提交任务。
  await page.route("**/api/v1/image-assets", (route) =>
    route.fulfill({ status: 202, json: apiFixture({ uploadId: crypto.randomUUID() }) }),
  );
  let statusReads = 0;
  await page.route("**/api/v1/image-uploads/*", (route) => {
    statusReads++;
    return route.fulfill({ json: apiFixture({ status: "pending" }) });
  });
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      json: apiFixture({ id: crypto.randomUUID(), replayed: false }),
    });
  });
  await page.goto("/zh-CN/commerce/replica");
  await expect(page.getByRole("radiogroup", { name: "生成张数" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Image 2.6/ })).toHaveCount(0);
  const generate = page.getByRole("button", { name: /^立即生成/ });
  await expect(generate).toBeDisabled();
  await page
    .getByRole("region", { name: "风格图", exact: true })
    .locator("input[type=file]")
    .setInputFiles({ name: "style.webp", mimeType: "image/webp", buffer: png });
  await expect(generate).toBeDisabled();
  await page
    .getByRole("region", { name: "参考图", exact: true })
    .locator("input[type=file]")
    .setInputFiles(
      Array.from({ length: 10 }, (_, index) => ({
        name: `product-${index}.webp`,
        mimeType: "image/webp",
        buffer: readFileSync(
          new URL(
            `../fixtures/studio/textile-views/${
              [
                "angled-level",
                "angled-overhead",
                "bed-end",
                "close-up",
                "draped",
                "fabric",
                "front",
                "overhead-close",
                "overhead-wide",
                "pillow",
              ][index]
            }.webp`,
            import.meta.url,
          ),
        ),
      })),
    );
  await expect(generate).toBeEnabled();
  await expect(generate).toContainText("20");
  await page.getByRole("textbox", { name: "补充要求" }).fill("保留商品细节");
  await expect(page.getByRole("button", { name: /优化/, exact: false })).toBeVisible();
  await generate.click();
  await expect
    .poll(() => submitted)
    .toMatchObject({
      replica: true,
      referenceRoles: ["style", ...Array(10).fill("product")],
      model: "gpt-image-2.6",
      count: 10,
      prompt: expect.stringContaining("以第一张图为版式模板"),
    });
  expect(statusReads).toBe(0);
  await expect(page.getByRole("button", { name: "已提交", exact: true })).toBeVisible();
  await expect(page.getByText("已提交，可在生成记录中查看进度。", { exact: true })).toHaveCount(0);
});

test("reduced-motion tool menu stays available without a duplicate banner preview", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockImageApi(page);
  await page.goto("/zh-CN/commerce/replica");
  const button = page
    .locator(".workspace-tool-bar")
    .getByRole("button", { name: "商品图片", exact: true });
  await expect(button).toHaveAttribute("data-current", "true");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".workspace-tool-submenu")).toBeVisible();
  await expect(button).toHaveCSS("height", "50px");
  await expect(button.locator(".workspace-tool-chevron .ui-icon")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".workspace-tool-preview-card")).toHaveCount(0);
  const banner = page.locator(".workspace-composer-hero");
  await expect(banner.getByRole("heading", { name: "复制爆款", exact: true })).toBeVisible();
  await expect(banner.getByRole("img", { name: /橙色耳机/ })).toBeVisible();
  await expect(banner).not.toContainText(/风格参考|我的商品|成图/);
  await banner.hover();
  // 覆盖旧浮层的延迟，确认离开菜单后没有第二张示例图弹出。
  await page.waitForTimeout(450);
  await expect(page.locator(".workspace-tool-preview-card")).toHaveCount(0);
  await page.goto("/zh-CN");
  await expect(page.getByRole("tab", { name: "商品视频" })).toHaveCount(0);
});
