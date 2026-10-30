import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const path of ["/create", "/commerce/smart-variation", "/"]) {
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
    await expect(menu.getByRole("tab", { name: "当前图片", exact: true })).toBeVisible();
    await menu.getByRole("tab", { name: "历史上传", exact: true }).click();
    await expect(menu.getByRole("option")).toHaveCount(1);
    await menu.getByRole("tab", { name: "生成图片", exact: true }).click();
    await menu.getByRole("textbox", { name: "搜索图片" }).fill("商品颜色2");
    await expect(menu.getByRole("option")).toHaveCount(1);
    await menu.getByRole("option").click();
    await menu.getByRole("button", { name: "确认（1/5）", exact: true }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator(".reference-tile")).toHaveCount(1);
    await expect(prompt).toContainText("图片1");
    for (let index = 0; index < 4; index++) {
      await prompt.press("End");
      await prompt.press("@");
      menu = page.getByRole("dialog", { name: "引用图片", exact: true });
      await menu.getByRole("tab", { name: "生成图片", exact: true }).click();
      const options = menu.getByRole("option");
      await expect(options.filter({ hasText: "PAAAAAAA2" })).toBeDisabled();
      await options.filter({ hasText: `PAAAAAAA${index === 0 ? 1 : index + 2}` }).click();
      await menu.getByRole("button", { name: "确认（1/5）", exact: true }).click();
    }
    await expect(page.locator(".reference-tile")).toHaveCount(5);
    await prompt.press("End");
    await prompt.press("@");
    await menu.getByRole("tab", { name: "生成图片", exact: true }).click();
    await expect(menu.getByRole("option").filter({ hasText: "PAAAAAAA6" })).toBeDisabled();
    await page.keyboard.press("Escape");
    if (path === "/") {
      for (let index = 0; index < 5; index++)
        await page.getByRole("button", { name: "移除参考图：图片1", exact: true }).press("Enter");
    } else await page.getByRole("button", { name: "清除全部参考图片", exact: true }).click();
    await expect(page.locator(".reference-tile")).toHaveCount(0);
    await expect(prompt).toHaveValue("@");
  });
}

test("mention multi-selection stays neutral and caps pending selection at five on mobile", async ({
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
  const tab = menu.getByRole("tab", { name: "历史上传", exact: true });
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
  for (let index = 0; index < 5; index++) await menu.getByRole("option").nth(index).click();
  await expect(menu.getByRole("option").nth(5)).toBeDisabled();
  await expect(menu).not.toContainText("同一张图片只能引用一次");
  await page.screenshot({ path: "/tmp/lycobo-reference-multiselect-mobile.png" });
  await menu.getByRole("button", { name: "确认（5/5）", exact: true }).click();
  await expect(page.locator(".reference-tile")).toHaveCount(5);
  await expect(page.locator(".reference-prompt-chip")).toHaveCount(5);
});
