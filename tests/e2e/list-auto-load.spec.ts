import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const path of ["/create", "/"]) {
  test(`a prompt needs a description rather than only references in ${path}`, async ({ page }) => {
    await mockImageApi(page);
    await page.goto(path);
    const button = page.locator(path === "/" ? ".home-submit" : ".generation-submit");
    const prompt = page
      .locator(path === "/" ? ".home-prompt" : ".prompt-field")
      .getByRole("textbox");
    await expect(button).toBeDisabled();
    await prompt.press("@");
    await expect(button).toBeDisabled();
    await page.keyboard.press("Escape");
    await prompt.fill("@图片1 @图片2");
    await expect(button).toBeDisabled();
    await prompt.press("End");
    await prompt.pressSequentially("保留商品主体");
    await expect(button).toBeEnabled();
  });
}

for (const path of ["/", "/create", "/commerce/smart-variation", "/video"]) {
  test(`reference list in ${path} stays in the window, pages at its bottom and stops on error`, async ({
    page,
  }) => {
    await mockImageApi(page);
    let nextRequests = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const assets = Array.from({ length: 30 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      kind: "reference",
      task_public_id: null,
      type: "image",
      width: 100,
      height: 100,
      bytes: 100,
      created_at: "2026-10-30T00:00:00Z",
      model: null,
      prompt: null,
    }));
    await page.route("**/api/v1/image-assets?*", async (route) => {
      const url = new URL(route.request().url());
      if (!url.searchParams.get("before"))
        return route.fulfill({ json: apiFixture({ data: assets }) });
      nextRequests++;
      await gate;
      return route.fulfill({ status: 500, json: apiFixture({}, 500) });
    });
    await page.goto(path);
    await page
      .locator(path === "/" ? ".home-prompt" : ".prompt-field")
      .getByRole("textbox")
      .press("@");
    const dialog = page.getByRole("dialog", { name: "引用图片", exact: true });
    await expect(dialog.getByRole("option")).toHaveCount(30);
    expect(nextRequests).toBe(0);
    // The sentinel only fires on screen, and the popover never flips above the mention.
    const list = dialog.locator(".reference-mention-scroll");
    await expect(list).toBeInViewport({ ratio: 1 });
    const at = await page.locator(".reference-at").boundingBox();
    const popover = await page.locator(".reference-mention-popover").boundingBox();
    expect(popover?.y).toBeGreaterThan((at?.y ?? 0) + (at?.height ?? 0));
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => nextRequests).toBe(1);
    await expect(dialog.getByLabel("正在加载列表")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /加载更多/ })).toHaveCount(0);
    release?.();
    await expect(dialog.getByLabel("正在加载列表")).toBeHidden();
    await expect(dialog.getByRole("button", { name: "重新加载" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "搜索图片" }).focus();
    expect(nextRequests).toBe(1);
  });
}

test("asset library appends another page and stops when the list is complete", async ({ page }) => {
  await mockImageApi(page);
  let nextRequests = 0;
  const assets = Array.from({ length: 31 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    kind: "output",
    task_public_id: null,
    type: "image",
    width: 100,
    height: 100,
    bytes: 100,
    created_at: "2026-10-30T00:00:00Z",
    model: "gpt-image-2",
    prompt: `商品${index}`,
  }));
  await page.route("**/api/v1/image-assets?*", (route) => {
    const more = new URL(route.request().url()).searchParams.has("before");
    if (more) nextRequests++;
    return route.fulfill({
      json: apiFixture({ data: more ? assets.slice(30) : assets.slice(0, 30) }),
    });
  });
  // Short enough that the first page's sentinel starts below the fold at the default density.
  await page.setViewportSize({ width: 1280, height: 420 });
  await page.goto("/assets");
  await expect(page.locator(".asset-tile")).toHaveCount(30);
  await page.locator(".infinite-load").scrollIntoViewIfNeeded();
  await expect(page.locator(".asset-tile")).toHaveCount(31);
  await expect(page.locator(".infinite-load")).toHaveCount(0);
  expect(nextRequests).toBe(1);
});
