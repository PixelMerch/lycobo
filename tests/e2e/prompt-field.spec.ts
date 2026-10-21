import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("workspace prompt grows with content, caps at 5000 and shows a counter", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  const counter = page.locator(".prompt-count");
  await expect(counter).toHaveText("0/5000");
  const initial = await prompt.boundingBox();
  await prompt.fill("第一行\n".repeat(10));
  await expect
    .poll(async () => (await prompt.boundingBox())?.height ?? 0)
    .toBeGreaterThan(initial?.height ?? 0);
  const grown = await prompt.boundingBox();
  expect(grown && grown.height > (initial?.height ?? 0)).toBe(true);
  expect(await prompt.evaluate((node) => getComputedStyle(node).overflowY)).toBe("hidden");
  expect(await prompt.evaluate((node) => getComputedStyle(node).resize)).toBe("none");
  await prompt.fill("字".repeat(6000));
  await expect(prompt).toHaveValue("字".repeat(5000));
  await expect(counter).toHaveText("5000/5000");
  const clear = page.getByRole("button", { name: "清空提示词", exact: true });
  const count = await counter.boundingBox();
  const clearBox = await clear.boundingBox();
  expect(clearBox && count && clearBox.x + clearBox.width <= count.x).toBe(true);
  await clear.click();
  await expect(prompt).toHaveValue("");
  await expect(counter).toHaveText("0/5000");
  await expect(prompt).toBeFocused();
});

test("workspace rich prompt matches the counter and grows after inserting a reference", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/create");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("添加参考图片", { exact: true })
    .setInputFiles({ name: "product.png", mimeType: "image/png", buffer: png });
  const prompt = page.getByLabel("提示词", { exact: true });
  const richPrompt = `保留 @图片1 ${"细节\n".repeat(12)}`;
  await prompt.fill(richPrompt);
  await expect(page.locator(".prompt-count")).toHaveText(`${richPrompt.length}/5000`);
  const box = await prompt.boundingBox();
  expect(box && box.height > 100).toBe(true);
  await prompt.fill("字".repeat(6000));
  await expect(page.locator(".prompt-count")).toHaveText("5000/5000");
});

test("generation count stays collapsed behind a more toggle", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/create");
  const count = page.getByRole("group", { name: "生成张数", exact: true });
  await expect(count).toHaveCount(0);
  const more = page.getByRole("button", { name: "更多", exact: true });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(count).toBeVisible();
  await count.getByRole("radio", { name: "3", exact: true }).click();
  await expect(page.getByRole("button", { name: /立即生成/ })).toBeVisible();
  await page.getByRole("button", { name: "收起", exact: true }).click();
  await expect(count).toHaveCount(0);
});
