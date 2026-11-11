import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
  await page.route("**/api/v1/variation-plans/capabilities", (route) =>
    route.fulfill({ json: apiFixture({ enabled: true }) }),
  );
  await page.route("**/api/v1/variation-plans", (route) => {
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: apiFixture({
        id: crypto.randomUUID(),
        status: "ready",
        ...input,
        items: Array.from({ length: 10 }, (_, i) => ({
          id: crypto.randomUUID(),
          title: `场景${i + 1}`,
          prompt: `独立商品场景${i + 1}，保留白色与商品花纹。`,
        })),
      }),
    });
  });
});

test("analysis requires text, preserves edited plans and submits only confirmed selections", async ({
  page,
}) => {
  let generations = 0;
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    generations++;
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 202,
      json: apiFixture({ id: crypto.randomUUID(), replayed: false }),
    });
  });
  await page.goto("/commerce/smart-variation");
  const description = page.getByRole("textbox", { name: "创作需求", exact: true });
  await description.fill("@");
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
  await page.reload();
  await description.fill("为杯子生成十种商品场景，保留主体");
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  const dialog = page.getByRole("region", { name: "确认每张图的中文提示词", exact: true });
  await expect(dialog.locator(".variation-plan-card")).toHaveCount(10);
  expect(generations).toBe(0);
  await dialog.getByRole("textbox", { name: "方案 1 名称", exact: true }).fill("橙色桌面");
  await dialog
    .getByRole("textbox", { name: "方案 1 提示词", exact: true })
    .fill("只换成橙色桌面，保留商品花纹。");
  await dialog
    .getByRole("region", { name: "方案 2", exact: true })
    .locator(".checkbox__content")
    .click();
  await dialog.getByRole("button", { name: "删除方案 3", exact: true }).click();
  await expect(dialog).toContainText("已选 8 张");
  await dialog.getByRole("button", { name: "关闭生成计划", exact: true }).click();
  await page
    .getByRole("navigation", { name: "电商创作工具" })
    .getByRole("button", { name: "主图制作", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "电商创作工具" })
    .getByRole("button", { name: "套图计划", exact: true })
    .click();
  await page.getByRole("button", { name: "查看生成计划", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "方案 1 名称", exact: true })).toHaveValue(
    "橙色桌面",
  );
  await dialog.getByRole("button", { name: /开始生成/ }).click();
  await expect(dialog).toBeHidden();
  expect(generations).toBe(1);
  expect(submitted).toMatchObject({
    model: "gpt-image-2.6",
    count: 8,
    prompt: "为杯子生成十种商品场景，保留主体",
    variation: {
      version: 1,
      items: expect.arrayContaining([
        expect.objectContaining({ title: "橙色桌面", prompt: "只换成橙色桌面，保留商品花纹。" }),
      ]),
    },
  });
  await expect(description).toHaveValue("");
});

for (const width of [1440, 390, 320])
  test(`plan overlay remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/smart-variation");
    await page.getByRole("textbox", { name: "创作需求", exact: true }).fill("为杯子生成十种场景");
    await page.getByRole("button", { name: "立即生成", exact: true }).click();
    const dialog = page.getByRole("region", { name: "确认每张图的中文提示词", exact: true });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "关闭生成计划", exact: true }),
    ).toBeInViewport();
    await expect(dialog.getByRole("button", { name: /开始生成/ })).toBeInViewport();
    await dialog
      .getByRole("textbox", { name: "方案 10 提示词", exact: true })
      .fill("第十张商品图的修改内容");
    await expect(dialog.getByRole("button", { name: /开始生成/ })).toBeInViewport();
    if (width === 1440) {
      const panel = await dialog.boundingBox();
      const composer = await page.locator(".composer-panel").boundingBox();
      const rail = await page.locator(".history-rail").boundingBox();
      expect(panel).not.toBeNull();
      expect(composer).not.toBeNull();
      expect(
        Math.abs((panel?.x ?? 0) - ((composer?.x ?? 0) + (composer?.width ?? 0) + 12)),
      ).toBeLessThanOrEqual(1);
      expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBeLessThanOrEqual(rail?.x ?? Infinity);
      await expect(page.locator(".results-panel")).toBeHidden();
      await expect(page.locator(".modal__backdrop")).toHaveCount(0);
      await page.screenshot({ path: "/tmp/lycobo-variation-plan-panel.png" });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test("plan actions are not covered by the page back-to-top button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/commerce/smart-variation");
  await page.getByRole("textbox", { name: "创作需求", exact: true }).fill("为杯子生成十种场景");
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  const backToTop = page.getByRole("button", { name: "回到顶部", exact: true });
  await expect(backToTop).toBeVisible();
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  const panel = page.getByRole("region", { name: "确认每张图的中文提示词", exact: true });
  await expect(panel).toBeVisible();
  await expect(backToTop).toBeHidden();
  await panel.getByRole("button", { name: /开始生成/ }).click({ trial: true });
  await panel.getByRole("button", { name: "关闭生成计划", exact: true }).click();
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await expect(backToTop).toBeVisible();
});

test("analysis shows progress, blocks repeated presses and opens normalized plans", async ({
  page,
}) => {
  let calls = 0;
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/variation-plans", async (route) => {
    calls++;
    const input = route.request().postDataJSON();
    await waiting;
    await route.fulfill({
      json: apiFixture({
        id: crypto.randomUUID(),
        status: "ready",
        ...input,
        description: input.description.trim(),
        items: [
          {
            id: crypto.randomUUID(),
            title: "橙色款",
            prompt: "保留白色与花纹，只修改商品主色为橙色。",
          },
        ],
      }),
    });
  });
  await page.goto("/commerce/smart-variation");
  await page.getByRole("textbox", { name: "创作需求", exact: true }).fill("生成一个橙色商品方案\n");
  const button = page.locator(".variation-submit .generation-submit");
  await button.click();
  try {
    await expect(page.getByRole("region", { name: "正在生成套图计划", exact: true })).toBeVisible();
    await expect(button).toBeDisabled();
    // 生成中文字不变，只出现加载图标（读屏说明“正在生成计划”），也不显示成禁用的灰色。
    await expect(button.getByRole("status", { name: "正在生成计划" })).toBeVisible();
    await expect(button).toContainText("立即生成");
    await expect(button).not.toContainText("正在生成计划");
    await expect(button).toHaveAttribute("data-submitting", "true");
    await button.evaluate((node) => {
      if (node instanceof HTMLButtonElement) {
        node.click();
        node.click();
      }
    });
    expect(calls).toBe(1);
  } finally {
    release?.();
  }
  await expect(
    page.getByRole("region", { name: "确认每张图的中文提示词", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
});

test("streams read-only plan cards before the saved plan becomes editable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (resource, init) => {
      if (String(resource) !== "/api/v1/variation-plans" || init?.method !== "POST")
        return original(resource, init);
      const input = JSON.parse(String(init.body));
      const encoder = new TextEncoder();
      const item = {
        id: crypto.randomUUID(),
        title: "橙色款",
        prompt: "保留商品结构，换成橙色，自然光场景。",
      };
      return new Response(
        new ReadableStream({
          start(controller) {
            const emit = (event: string, data: unknown) =>
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            emit("started", {});
            emit("status", { stage: "reading" });
            setTimeout(() => {
              emit("status", { stage: "planning" });
              emit("delta", { text: '{"items":[{"title":"橙色款","prompt":"保留商品结构' });
            }, 1000);
            setTimeout(() => {
              emit("delta", { text: '，换成橙色，自然光场景。"}]}' });
              emit("complete", {
                id: crypto.randomUUID(),
                status: "ready",
                ...input,
                items: [item],
              });
              controller.close();
            }, 2000);
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    };
  });
  await page.goto("/commerce/smart-variation");
  await page.getByRole("textbox", { name: "创作需求", exact: true }).fill("生成橙色商品图");
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  const pending = page.getByRole("region", { name: "正在生成套图计划", exact: true });
  await expect(pending).toBeVisible();
  await expect(pending).toContainText("DeepSeek 正在读取网页内容");
  await expect(pending).toContainText("保留商品结构");
  await expect(pending.getByRole("textbox")).toHaveCount(0);
  await expect(pending.getByRole("button", { name: /开始生成/ })).toBeDisabled();
  const ready = page.getByRole("region", { name: "确认每张图的中文提示词", exact: true });
  await expect(ready.getByRole("textbox", { name: "方案 1 提示词", exact: true })).toHaveValue(
    "保留商品结构，换成橙色，自然光场景。",
  );
});

test("failed webpage reading keeps the draft and permits a fresh retry", async ({ page }) => {
  await page.route("**/api/v1/variation-plans", async (route) => {
    const input = route.request().postDataJSON();
    const plan = { id: crypto.randomUUID(), status: "failed", ...input, items: [] };
    await route.fulfill({
      contentType: "text/event-stream",
      body: `event: status\ndata: {"stage":"link_failed"}\n\nevent: complete\ndata: ${JSON.stringify(plan)}\n\n`,
    });
  });
  await page.goto("/commerce/smart-variation");
  const description = page.getByRole("textbox", { name: "创作需求", exact: true });
  await description.fill("参考 https://shop.example/item 生成一张图");
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  await expect(page.locator(".variation-plan-stream-status")).toContainText("网页读取未完成");
  await expect(description).toHaveValue("参考 https://shop.example/item 生成一张图");
  await expect(page.getByRole("button", { name: /开始生成/ })).toBeDisabled();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith("lycobo-variation-plan:")),
    ),
  ).toEqual([]);
});

for (const path of ["/commerce/smart-variation", "/commerce/create"])
  test(`editing a long prompt preserves composer scroll and caret on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const prompt = page.locator(".prompt-field").getByRole("textbox");
    await prompt.fill("1".repeat(903));
    await prompt.press("End");
    await prompt.evaluate((element) => element.blur());
    await page.waitForTimeout(500);
    const before = await prompt.evaluate((element) => {
      const scroller = element.closest(".composer-scroll");
      if (!(scroller instanceof HTMLElement)) throw new Error("Missing composer scroller");
      scroller.scrollTo({ top: 400, behavior: "instant" });
      return scroller.scrollTop;
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const box = await prompt.boundingBox();
    if (!box) throw new Error("Missing prompt");
    await page.mouse.click(box.x + 45, Math.max(box.y + 35, 380));
    await expect(prompt).toBeFocused();
    expect(await prompt.evaluate((element) => element.closest(".composer-scroll")?.scrollTop)).toBe(
      before,
    );
    await page.keyboard.type("2");
    await expect
      .poll(() => prompt.evaluate((element) => element.closest(".composer-scroll")?.scrollTop))
      .toBe(before);
    expect(
      await prompt.evaluate((element) =>
        element instanceof HTMLTextAreaElement ? element.selectionStart : -1,
      ),
    ).toBeGreaterThan(0);
    const changed = await prompt.inputValue();
    expect(changed.indexOf("2")).toBeGreaterThan(0);
    expect(changed.indexOf("2")).toBeLessThan(903);
    await page.getByRole("button", { name: "清空提示词", exact: true }).click();
    await expect(prompt).toHaveValue("");
    expect(await prompt.evaluate((element) => element.getBoundingClientRect().height)).toBe(100);
  });
