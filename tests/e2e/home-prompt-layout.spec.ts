import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const width of [1440, 390]) {
  test(`home prompt grows without covering its actions at ${width}px`, async ({ page }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const prompt = page.getByRole("textbox", { name: "创作需求", exact: true });
    await prompt.fill("商品主图");
    const initial = await prompt.boundingBox();
    const long = Array.from(
      { length: 45 },
      (_, index) => `第${index + 1}行：保留商品细节与真实颜色。`,
    ).join("\n");
    for (const text of [long, `@图片1 ${long}`]) {
      await prompt.fill(text);
      await expect(page.locator(".prompt-count")).toHaveText(`${text.length}/5000`);
      const wand = page.getByRole("button", { name: "AI 优化提示词", exact: true });
      const clear = page.getByRole("button", { name: "清空提示词", exact: true });
      const [editor, optimize, clearBounds] = await Promise.all([
        prompt.boundingBox(),
        wand.boundingBox(),
        clear.boundingBox(),
      ]);
      expect(editor?.height).toBeGreaterThan(initial?.height ?? 0);
      expect(optimize?.y).toBeGreaterThanOrEqual((editor?.y ?? 0) + (editor?.height ?? 0));
      expect(clearBounds?.x).toBeGreaterThan((optimize?.x ?? 0) + (optimize?.width ?? 0));
      await expect(prompt).toHaveCSS("overflow-y", "auto");
      await wand.click();
      await expect(page.getByRole("group", { name: "确认优化提示词" })).toBeVisible();
      await page.getByRole("button", { name: "取消", exact: true }).click();
    }
    await page.getByRole("button", { name: "清空提示词", exact: true }).click();
    await expect(prompt).toHaveValue("");
    await expect(prompt).toBeFocused();
    await expect(page.locator(".prompt-count")).toHaveText("0/5000");
    await expect.poll(async () => (await prompt.boundingBox())?.height).toBe(initial?.height);
    await prompt.fill("主图".repeat(2600));
    await expect(prompt).toHaveValue("主图".repeat(2500));
    await expect(page.locator(".prompt-count")).toHaveText("5000/5000");
    await page.screenshot({ path: `/tmp/lycobo-home-prompt-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
