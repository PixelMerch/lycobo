import { expect, type Page, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

const rewrite = "奶油色菱格绗缝床品平铺在原木床架上，清晨侧光透过纱帘落在被面，突出绗缝纹理。";
const delta = (text: string) => `event: delta\ndata: ${JSON.stringify({ text })}\n\n`;
const sse = { "Content-Type": "text/event-stream" };

async function openCreate(page: Page) {
  await mockImageApi(page);
  await page.goto("/create");
  const prompt = page.getByRole("textbox", { name: "提示词" });
  await expect(prompt).toBeVisible({ timeout: 15000 });
  return { prompt, wand: page.getByRole("button", { name: "AI 优化提示词" }) };
}

async function confirmOptimization(page: Page) {
  const dialog = page.getByRole("dialog", { name: "AI 优化提示词" });
  await expect(dialog.getByText(/本次优化将消耗 1 积分/)).toBeVisible();
  await dialog.getByRole("button", { name: "确认优化" }).click();
}

test("the wand hints after typing and canceling never requests optimization", async ({ page }) => {
  const { prompt, wand } = await openCreate(page);
  const requests: string[] = [];
  await page.route("**/api/v1/prompt-optimizations", (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await prompt.fill("奶油色床品 晨光");
  await expect(wand).toHaveText("优化");
  const icon = wand.locator("svg");
  await expect(icon).toHaveCSS("animation-name", "prompt-wand-hint");
  const spark = wand.locator(".prompt-optimize-wand");
  const sparkAnimation = () =>
    spark.evaluate((element) =>
      ["::before", "::after"].map((part) => getComputedStyle(element, part).animationName),
    );
  await expect.poll(sparkAnimation).toEqual(["prompt-wand-spark", "prompt-wand-spark"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(icon).toHaveCSS("animation-name", "none");
  await expect.poll(sparkAnimation).toEqual(["none", "none"]);

  await wand.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "AI 优化提示词" });
  await expect(dialog.getByText(/本次优化将消耗 1 积分/)).toBeVisible();
  expect(requests).toEqual([]);
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toBeHidden();
  await expect(wand).toBeFocused();
  await expect(prompt).toHaveValue("奶油色床品 晨光");
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "清空提示词" }).click();
  await expect(wand).toHaveCount(0);
  await prompt.fill("  。 ");
  await expect(wand).toHaveCount(0);
});

test("the wand rewrites a described prompt, which stays editable and can be undone", async ({
  page,
}) => {
  const { prompt, wand } = await openCreate(page);
  const requests: { body: unknown; key: string | undefined }[] = [];
  await page.route("**/api/v1/prompt-optimizations", (route) => {
    requests.push({
      body: route.request().postDataJSON(),
      key: route.request().headers()["idempotency-key"],
    });
    return route.fulfill({
      headers: sse,
      body: `${delta(rewrite.slice(0, 12))}${delta(rewrite.slice(12))}event: complete\ndata: ${JSON.stringify({ text: rewrite })}\n\n`,
    });
  });
  await expect(wand).toHaveCount(0);
  await prompt.fill("奶油色床品 晨光");
  await wand.click();
  await confirmOptimization(page);
  await expect(prompt).toHaveValue(rewrite);
  expect(requests).toEqual([
    {
      body: { prompt: "奶油色床品 晨光", tool: "create" },
      key: expect.stringMatching(/^[a-f0-9-]{36}$/),
    },
  ]);

  const undo = page.getByRole("button", { name: "恢复优化前的提示词" });
  await undo.click();
  await expect(prompt).toHaveValue("奶油色床品 晨光");
  await expect(undo).toHaveCount(0);

  await wand.click();
  await confirmOptimization(page);
  await expect(prompt).toHaveValue(rewrite);
  await prompt.fill(`${rewrite}再加一句`);
  await expect(prompt).toHaveValue(`${rewrite}再加一句`);
  await expect(undo).toHaveCount(0);
});

test("a failed rewrite gives the prompt back", async ({ page }) => {
  const { prompt, wand } = await openCreate(page);
  await page.route("**/api/v1/prompt-optimizations", (route) =>
    route.fulfill({ headers: sse, body: `${delta("写到一半")}event: failed\ndata: {}\n\n` }),
  );
  await prompt.fill("奶油色床品 晨光");
  await wand.click();
  await confirmOptimization(page);
  await expect(page.getByText("提示词优化失败，已退还积分", { exact: true }).first()).toBeVisible();
  await expect(prompt).toHaveValue("奶油色床品 晨光");
  await expect(page.getByRole("button", { name: "恢复优化前的提示词" })).toHaveCount(0);
});

test("stopping gives the prompt back without an error", async ({ page }) => {
  const { prompt, wand } = await openCreate(page);
  await page.route("**/api/v1/prompt-optimizations", () => {
    // Held open: the run only ends when the user stops it.
  });
  await prompt.fill("奶油色床品 晨光");
  await wand.click();
  await confirmOptimization(page);
  const stop = page.getByRole("button", { name: "停止优化" });
  await expect(stop).toBeVisible();
  await expect(prompt).not.toBeEditable();
  await expect(page.getByRole("button", { name: "清空提示词" })).toBeDisabled();
  await stop.click();
  await expect(wand).toBeEnabled();
  await expect(prompt).toBeEditable();
  await expect(prompt).toHaveValue("奶油色床品 晨光");
  await expect(page.getByText("提示词优化失败，已退还积分", { exact: true })).toHaveCount(0);
});

test("the wand says so while the service is not available", async ({ page }) => {
  const { prompt, wand } = await openCreate(page);
  await page.route("**/api/v1/prompt-optimizations", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  await prompt.fill("奶油色床品 晨光");
  await wand.click();
  await confirmOptimization(page);
  await expect(page.getByText("提示词优化暂未开放", { exact: true }).first()).toBeVisible();
  await expect(prompt).toHaveValue("奶油色床品 晨光");
});

test("video scene descriptions ask for a video rewrite", async ({ page }) => {
  await mockImageApi(page);
  const bodies: unknown[] = [];
  await page.route("**/api/v1/prompt-optimizations", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({
      headers: sse,
      body: `${delta(rewrite)}event: complete\ndata: ${JSON.stringify({ text: rewrite })}\n\n`,
    });
  });
  await page.goto("/video");
  const prompt = page.getByRole("textbox", { name: "场景描述" });
  await expect(prompt).toBeVisible({ timeout: 15000 });
  await prompt.fill("晨光卧室，镜头推近");
  await page.getByRole("button", { name: "AI 优化提示词" }).click();
  await confirmOptimization(page);
  await expect(prompt).toHaveValue(rewrite);
  expect(bodies).toEqual([{ prompt: "晨光卧室，镜头推近", tool: "video" }]);
});
