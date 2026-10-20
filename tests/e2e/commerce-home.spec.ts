import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("home composer shares prompt and real reference drafts without submitting generation", async ({
  page,
}) => {
  await mockImageApi(page);
  let submissions = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/image-tasks"))
      submissions += 1;
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "创作需求" }).fill("为我的商品搭配自然光场景");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "product.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("为我的商品搭配自然光场景");
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  expect(submissions).toBe(0);
});

test("case filters combine, empty results recover and reuse preserves references", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/");
  await expect(page.locator(".commerce-case")).toHaveCount(4);
  await page.getByRole("radio", { name: "商品主图", exact: true }).click();
  await expect(page.locator(".commerce-case")).toHaveCount(1);
  await page.getByRole("button", { name: /商品品类/ }).click();
  await page.getByRole("option", { name: "美妆个护", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "还没有案例" })).toBeVisible();
  await page.getByRole("button", { name: "查看全部", exact: true }).click();
  await expect(page.locator(".commerce-case")).toHaveCount(4);
  await page.getByRole("textbox", { name: "创作需求" }).fill("已有草稿");
  await page.getByRole("button", { name: "做同款：香水 · 自然光场景" }).click();
  const dialog = page.getByRole("dialog", { name: "香水 · 自然光场景" });
  await dialog.getByRole("button", { name: "用这个提示词创作" }).click();
  await expect(dialog.getByRole("alert")).toContainText("已有草稿");
  await dialog.getByRole("button", { name: "保留草稿" }).click();
  await dialog.press("Escape");
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("已有草稿");
  await page.getByRole("button", { name: "做同款：香水 · 自然光场景" }).click();
  await dialog.getByRole("button", { name: "用这个提示词创作" }).click();
  await dialog.getByRole("button", { name: "替换并进入" }).click();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue(/保留参考商品的瓶身/);
  await expect(page.locator(".reference-tile")).toHaveCount(0);
});

for (const width of [320, 390, 768, 1440, 1920]) {
  test(`home remains operable at ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "电商案例", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width === 390 || width === 1920)
      await page.screenshot({ path: `/tmp/lycobo-home-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "查看案例：香水 · 自然光场景" }).click();
    const dialog = page.getByRole("dialog", { name: "香水 · 自然光场景" });
    await expect(dialog).toBeVisible();
    await dialog.press("Escape");
    await expect(page.getByRole("button", { name: "查看案例：香水 · 自然光场景" })).toBeFocused();
  });
}

test("recent works loads only authenticated output thumbnails and recovers from service errors", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        role: "member",
        account: "test-merchant",
      }),
    }),
  );
  let unavailable = true;
  const outputId = crypto.randomUUID();
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill(
      unavailable
        ? { status: 503, json: apiFixture({}, 503) }
        : {
            json: apiFixture({
              data: [
                {
                  id: outputId,
                  kind: "output",
                  width: 1024,
                  height: 1024,
                  bytes: 2048,
                  created_at: "2026-10-20T00:00:00Z",
                  model: "gpt-image-2",
                  prompt: "我的商品作品",
                },
                {
                  id: crypto.randomUUID(),
                  kind: "reference",
                  width: 1024,
                  height: 1024,
                  bytes: 2048,
                  created_at: "2026-10-20T00:00:00Z",
                  model: null,
                  prompt: "不能当成作品的参考图",
                },
              ],
            }),
          },
    ),
  );
  await page.goto("/");
  const recent = page.getByRole("region", { name: "最近作品", exact: true });
  await expect(recent.getByRole("alert")).toContainText("作品暂时无法加载");
  unavailable = false;
  await recent.getByRole("button", { name: "重新加载" }).click();
  await expect(recent.getByRole("link", { name: "查看作品：我的商品作品" })).toBeVisible();
  await expect(recent.locator("img")).toHaveAttribute("src", new RegExp(`${outputId}.*thumbnail`));
  await expect(recent.getByText("不能当成作品的参考图")).toHaveCount(0);
});
