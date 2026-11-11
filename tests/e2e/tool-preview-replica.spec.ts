import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = readFileSync(
  new URL("../../apps/web/public/studio/textile-views/front.webp", import.meta.url),
);

test("tool menu hover stays quiet while the banner retains examples and drafts survive switching", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/zh-CN/commerce/create");
  const prompt = page.locator("textarea").first();
  await prompt.fill("保留当前商品草稿");
  const rail = page.getByRole("navigation", { name: "电商创作工具", exact: true });
  await expect(rail.getByRole("button", { name: "商品视频" })).toHaveCount(0);
  // 先在工具外移动鼠标，模拟用户从输入模式切回指针模式。
  await page.mouse.move(600, 80);
  await rail.getByRole("button", { name: "家纺裂变", exact: true }).hover();
  const preview = page.locator(".workspace-tool-preview-card");
  // 覆盖原来的300ms延迟，确认菜单不会稍后再弹出示例。
  await page.waitForTimeout(450);
  await expect(preview).toHaveCount(0);
  await page.locator(".workspace-composer-hero").hover();
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("效果示例");
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(prompt).toHaveValue("保留当前商品草稿");
  await page.keyboard.press("Escape");
  await rail.getByRole("button", { name: "复制爆款", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/replica$/);
  await rail.getByRole("button", { name: "主图制作", exact: true }).click();
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
            `../../apps/web/public/studio/textile-views/${
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
    });
  expect(statusReads).toBe(0);
  await expect(page.getByText("任务已提交，关闭页面也会继续处理。", { exact: true })).toBeVisible();
});

test("reduced-motion keyboard preview is static and home hides video", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockImageApi(page);
  await page.goto("/zh-CN/commerce/create");
  const button = page
    .locator(".workspace-tool-bar")
    .getByRole("button", { name: "复制爆款", exact: true });
  await button.focus();
  await expect(page.locator(".workspace-tool-preview-card")).toHaveCount(0);
  await page.locator(".workspace-composer-hero").focus();
  const preview = page.locator(".workspace-tool-preview-card");
  await expect(preview).toBeVisible();
  await expect(preview.locator(".workspace-tool-preview-source")).toBeHidden();
  await page.goto("/zh-CN");
  await expect(page.getByRole("tab", { name: "商品视频" })).toHaveCount(0);
});
