import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const path of ["/commerce/create", "/commerce/smart-variation", "/"]) {
  test(`references browse history, search, reject duplicates and cap at five in ${path}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const assets = Array.from({ length: 6 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      task_public_id: null,
      public_id: `PAAAAAAA${index + 1}`,
      kind: "output",
      type: "image",
      width: 1254,
      height: 1254,
      bytes: 1000,
      created_at: "2026-10-30T00:00:00Z",
      model: "gpt-image-2.5",
      prompt: `商品颜色${index + 1}`,
    }));
    await page.route("**/api/v1/image-assets?*", (route) => {
      const kind = new URL(route.request().url()).searchParams.get("kind");
      return route.fulfill({
        json: apiFixture({
          data: kind === "reference" ? [{ ...assets[0], kind: "reference" }] : assets,
        }),
      });
    });
    await page.goto(path);
    const prompt = page
      .locator(path === "/" ? ".home-prompt" : ".prompt-field")
      .getByRole("textbox");
    await prompt.press("@");
    let menu = page.getByRole("dialog", { name: "引用图片", exact: true });
    await expect(menu.getByRole("tab", { name: "图片", exact: true })).toBeVisible();
    await menu.getByRole("tab", { name: "图片", exact: true }).click();
    await expect(menu.getByRole("option")).toHaveCount(1);
    await menu.getByRole("tab", { name: "素材", exact: true }).click();
    await menu.getByRole("textbox", { name: "搜索图片" }).fill("商品颜色2");
    await expect(menu.getByRole("option")).toHaveCount(1);
    await menu.getByRole("option").click();
    await expect(menu).toBeHidden();
    await expect(page.locator(".reference-tile")).toHaveCount(1);
    await expect(prompt).toContainText("图片1");
    for (let index = 0; index < 4; index++) {
      await prompt.press("End");
      await prompt.press("@");
      menu = page.getByRole("dialog", { name: "引用图片", exact: true });
      await menu.getByRole("tab", { name: "素材", exact: true }).click();
      const options = menu.getByRole("option");
      await expect(options.filter({ hasText: "PAAAAAAA2" })).toBeDisabled();
      await options.filter({ hasText: `PAAAAAAA${index === 0 ? 1 : index + 2}` }).click();
    }
    await expect(page.locator(".reference-tile")).toHaveCount(5);
    await prompt.press("End");
    await prompt.press("@");
    await menu.getByRole("tab", { name: "素材", exact: true }).click();
    await expect(menu.getByRole("option").filter({ hasText: "PAAAAAAA6" })).toBeDisabled();
    await page.keyboard.press("Escape");
    if (path === "/") {
      for (let index = 0; index < 5; index++)
        await page.getByRole("button", { name: "移除参考图：图片1", exact: true }).press("Enter");
    } else await page.getByRole("button", { name: "清除全部参考图片", exact: true }).click();
    await expect(page.locator(".reference-tile")).toHaveCount(0);
    await expect(prompt).toHaveText("@");
  });
}

test("style match references add favorites to the product tray", async ({ page }) => {
  await mockImageApi(page);
  const favorite = {
    id: "00000000-0000-4000-8000-000000000017",
    task_public_id: null,
    public_id: "PAAAAAAA1",
    kind: "output",
    type: "image",
    width: 512,
    height: 512,
    bytes: 1000,
    created_at: "2026-11-11T00:00:00Z",
    model: null,
    prompt: null,
    favorite: true,
  };
  await page.route("**/api/v1/image-assets?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: apiFixture({ data: params.has("favorite") ? [favorite] : [] }) });
  });
  await page.goto("/zh-CN/commerce/replica");
  const prompt = page.locator(".prompt-field").getByRole("textbox");
  await prompt.press("@");
  const menu = page.getByRole("dialog", { name: "引用图片", exact: true });
  await expect(menu.getByRole("tab", { name: "图片", exact: true })).toBeVisible();
  await expect(menu.getByRole("tab", { name: "素材", exact: true })).toBeVisible();
  await menu.getByRole("tab", { name: "收藏", exact: true }).click();
  await menu.getByRole("option", { name: favorite.public_id }).click();
  const products = page.getByRole("region", { name: "参考图", exact: true });
  await expect(products.locator(".reference-tile")).toHaveCount(1);
  await expect(prompt).toContainText("图片1");
  await products.getByRole("button", { name: "清除全部参考图片", exact: true }).click();
  await expect(prompt).toHaveValue("");
});

test("mention popup stays by the green at-sign and directly inserts up to five images on mobile", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const assets = Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    task_public_id: null,
    public_id: `PAAAAAAA${index + 1}`,
    kind: "reference",
    type: "image",
    width: 1254,
    height: 1254,
    bytes: 1000,
    created_at: "2026-10-30T00:00:00Z",
    model: null,
    prompt: null,
  }));
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill({ json: apiFixture({ data: assets }) }),
  );
  await page.goto("/commerce/smart-variation");
  const prompt = page.locator(".prompt-field").getByRole("textbox");
  await prompt.press("@");
  const menu = page.getByRole("dialog", { name: "引用图片", exact: true });
  const tab = menu.getByRole("tab", { name: "图片", exact: true });
  await tab.click();
  const search = menu.getByRole("textbox", { name: "搜索图片" });
  await search.focus();
  const styles = await search.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineColor, border: style.borderColor, shadow: style.boxShadow };
  });
  expect(JSON.stringify(styles)).not.toContain("168, 255, 0");
  expect(await tab.evaluate((element) => getComputedStyle(element).color)).not.toBe(
    "rgb(168, 255, 0)",
  );
  const at = page.locator(".reference-at");
  await expect(at).toHaveCSS("color", "rgb(168, 255, 0)");
  const atBox = await at.boundingBox();
  const menuBox = await page.locator(".reference-mention-popover").boundingBox();
  if (!atBox || !menuBox) throw new Error("Missing mention popup geometry");
  const gap = Math.max(menuBox.y - atBox.y - atBox.height, atBox.y - menuBox.y - menuBox.height);
  expect(gap).toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThan(20);
  expect(menuBox.y).toBeGreaterThanOrEqual(0);
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(844);
  await expect(menu.getByRole("button", { name: /^确认/ })).toHaveCount(0);
  const option = menu.getByRole("option").first();
  await search.focus();
  await expect(option).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await option.hover();
  await expect(option).toHaveCSS("background-color", "rgb(60, 60, 60)");
  await page.screenshot({ path: "/tmp/lycobo-reference-direct-mobile.png" });
  for (let index = 0; index < 5; index++) {
    if (index > 0) {
      await prompt.press("End");
      await prompt.press("@");
      await menu.getByRole("tab", { name: "图片", exact: true }).click();
    }
    await menu.getByRole("option").nth(index).click();
    await expect(menu).toBeHidden();
  }
  await expect(page.locator(".reference-tile")).toHaveCount(5);
  await expect(page.locator(".reference-prompt-chip")).toHaveCount(5);
});

test("files stay local until generation and partial upload retries reuse successful assets", async ({
  page,
}) => {
  await mockImageApi(page);
  let uploads = 0;
  let submissions = 0;
  const first = crypto.randomUUID(),
    second = crypto.randomUUID();
  await page.route("**/api/v1/image-assets", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    uploads++;
    if (uploads === 2) return route.fulfill({ status: 500, json: apiFixture({}, 500) });
    return route.fulfill({ json: apiFixture({ id: uploads === 1 ? first : second }) });
  });
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    submissions++;
    expect(route.request().postDataJSON().referenceAssetIds).toEqual([first, second]);
    return route.fulfill({ status: 400, json: apiFixture({}, 400) });
  });
  await page.goto("/commerce/create");
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles(["apps/web/public/studio/bedroom.webp", "apps/web/public/studio/lavender.webp"]);
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  expect(uploads).toBe(0);
  await page.locator(".prompt-field").getByRole("textbox").fill("保留商品，更换背景");
  const submit = page.locator(".generation-submit");
  await submit.click();
  await expect.poll(() => uploads).toBe(2);
  await expect(submit).toBeEnabled();
  expect(submissions).toBe(0);
  await submit.click();
  await expect.poll(() => submissions).toBe(1);
  expect(uploads).toBe(3);
});
