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
  const uploadBox = await page.locator(".home-upload").boundingBox();
  const promptBox = await page.getByRole("textbox", { name: "创作需求" }).boundingBox();
  expect(uploadBox && promptBox && uploadBox.y + uploadBox.height <= promptBox.y).toBe(true);
  await page.getByLabel("添加参考图片", { exact: true }).setInputFiles(
    Array.from({ length: 4 }, (_, index) => ({
      name: `product-${index}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await expect(page.locator(".reference-tile")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toHaveCount(0);
  for (let number = 5; number > 1; number -= 1) {
    await page
      .locator(".reference-tile")
      .nth(number - 1)
      .hover();
    await page.getByRole("button", { name: `移除参考图：图片${number}`, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "添加参考图", exact: true })).toBeVisible();

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
  await page.getByRole("button", { name: "做同款：床品 · 自然光场景" }).click();
  const dialog = page.getByRole("dialog", { name: "床品 · 自然光场景" });
  await dialog.getByRole("button", { name: "用这个提示词创作" }).click();
  await expect(dialog.getByRole("alert")).toContainText("已有草稿");
  await dialog.getByRole("button", { name: "保留草稿" }).click();
  await dialog.press("Escape");
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("已有草稿");
  await page.getByRole("button", { name: "做同款：床品 · 自然光场景" }).click();
  await dialog.getByRole("button", { name: "用这个提示词创作" }).click();
  await dialog.getByRole("button", { name: "替换并进入" }).click();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue(/保留参考床品的颜色/);
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
    await page.getByRole("button", { name: "查看案例：床品 · 自然光场景" }).click();
    const dialog = page.getByRole("dialog", { name: "床品 · 自然光场景" });
    await expect(dialog).toBeVisible();
    await dialog.press("Escape");
    await expect(page.getByRole("button", { name: "查看案例：床品 · 自然光场景" })).toBeFocused();
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

test("home settings preserve drafts and only image creation is offered", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  await page.getByRole("textbox", { name: "创作需求" }).fill("保留绗缝与面料细节");
  await page.getByRole("button", { name: "选择创作模型", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "模型和画面设置" });
  await expect(panel).toBeVisible();
  await panel.getByRole("radio", { name: "16:9", exact: true }).click();
  await panel.getByRole("button", { name: /gpt-image-2.5-flare/ }).click();
  await panel.press("Escape");
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("保留绗缝与面料细节");
  await expect(page.getByRole("button", { name: "选择创作模型", exact: true })).toContainText(
    "16:9",
  );
  await expect(page.getByRole("radio", { name: "商品视频" })).toHaveCount(0);
  await expect(page.getByText("视频生成即将开放", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("保留绗缝与面料细节");
});

test("image mentions insert at the cursor and preserve surrounding text", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  const prompt = page.getByRole("textbox", { name: "创作需求" });
  await prompt.fill("@");
  const menu = page.getByRole("dialog", { name: "引用已上传图片" });
  await expect(menu).toContainText("请先上传参考图片");
  await menu.press("Escape");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page.getByLabel("添加参考图片", { exact: true }).setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: png },
    { name: "b.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await prompt.fill("保留 面料");
  await prompt.press("Home");
  await prompt.press("ArrowRight");
  await prompt.press("ArrowRight");
  await prompt.press("@");
  await expect(menu).toBeVisible();
  await page.getByRole("option", { name: "图片2", exact: true }).click();
  await expect(prompt).toHaveValue("保留@图片2  面料");
  await expect(prompt).toBeFocused();
  await page.getByRole("button", { name: "开始创作", exact: true }).click();
  const workspacePrompt = page.getByLabel("提示词", { exact: true });
  await expect(workspacePrompt).toHaveValue("保留@图片2  面料");
  await workspacePrompt.fill("@");
  await expect(menu).toBeVisible();
  await menu.press("Tab");
  await expect(page.getByRole("option", { name: "图片1", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(workspacePrompt).toHaveValue("@图片1 ");
});
