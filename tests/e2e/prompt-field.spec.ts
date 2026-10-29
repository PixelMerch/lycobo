import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("workspace prompt grows with content, reserves room for the selected purpose and shows a counter", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/create");
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  const counter = page.locator(".prompt-count");
  await expect(counter).toHaveText("0/4995");
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
  await expect(prompt).toHaveValue("字".repeat(4995));
  await expect(counter).toHaveText("4995/4995");
  const clear = page.getByRole("button", { name: "清空提示词", exact: true });
  const count = await counter.boundingBox();
  const clearBox = await clear.boundingBox();
  expect(clearBox && count && clearBox.x + clearBox.width <= count.x).toBe(true);
  await clear.click();
  await expect(prompt).toHaveValue("");
  await expect(counter).toHaveText("0/4995");
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
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  const richPrompt = `保留 @图片1 ${"细节\n".repeat(12)}`;
  await prompt.fill(richPrompt);
  await expect(page.locator(".prompt-count")).toHaveText(`${richPrompt.length}/4995`);
  const box = await prompt.boundingBox();
  expect(box && box.height > 100).toBe(true);
  await prompt.fill("字".repeat(6000));
  await expect(page.locator(".prompt-count")).toHaveText("4995/4995");
});

test("image count stays visible and quality is available under more", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/create");
  const count = page.getByRole("group", { name: "生成张数", exact: true });
  const quality = page.getByRole("group", { name: "质量", exact: true });
  await expect(count).toBeVisible();
  await expect(quality).toHaveCount(0);
  const more = page.getByRole("button", { name: "更多", exact: true });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(count).toBeVisible();
  await expect(quality).toBeVisible();
  await count.getByRole("radio", { name: "3", exact: true }).click();
  await quality.getByRole("radio", { name: "高", exact: true }).click();
  await expect(page.getByRole("button", { name: /生成商品主图/ })).toBeVisible();
  await page.getByRole("button", { name: "收起", exact: true }).click();
  await expect(count).toBeVisible();
  await expect(quality).toHaveCount(0);
});
