import { expect, type Page, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
async function historyFixture(
  page: Page,
  quality: "high" | null = "high",
  withReferences = true,
  count = 1,
) {
  await mockImageApi(page);
  const reference = crypto.randomUUID();
  const input = {
    model: "gpt-image-2.5",
    prompt: "保留商品外形和面料纹理，更换为自然采光的美式卧室，不添加文字。".repeat(24),
    aspectRatio: "3:4",
    resolution: "1K",
    count,
    ...(quality ? { quality } : {}),
    referenceAssetIds: withReferences ? [reference, crypto.randomUUID()] : [],
  };
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: input.model,
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    requested_count: input.count,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: "succeeded",
    input,
    items: Array.from({ length: count }, (_, position) => ({
      id: crypto.randomUUID(),
      position,
      status: "succeeded",
      output_asset_id: crypto.randomUUID(),
      error_code: null,
      width: 1024,
      height: 1024,
      worker_id: "fixture-worker",
    })),
  };
  await page.route("**/api/v1/image-tasks*", (route) => route.fulfill({ json: { data: [job] } }));
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/create");
  await expect(page.locator(".generation-job")).toHaveCount(1);
  return { input, job };
}

test("history prompt expands, copies in full and shows uploaded references; icon actions show tooltips", async ({
  page,
  context,
}) => {
  const { input, job } = await historyFixture(page);
  const article = page.locator(".generation-job").first();
  await expect(article.getByText("已完成", { exact: true })).toHaveCount(0);
  await expect(article.getByRole("button", { name: "展开全部", exact: true })).toBeVisible();
  await article.getByRole("button", { name: "展开全部", exact: true }).click();
  await expect(article.locator(".generation-prompt")).not.toHaveClass(/prompt-collapsed/);
  await article.getByRole("button", { name: "收起", exact: true }).click();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.clock.install();
  await article.getByRole("button", { name: "复制提示词", exact: true }).click();
  await expect(page.locator(".toast__title")).toHaveText("复制成功");
  await expect(article.getByRole("button", { name: "复制提示词", exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(input.prompt);
  await page.clock.fastForward(4300);
  await page.clock.resume();
  await article.getByRole("button", { name: "重新编辑", exact: true }).hover();
  await expect(page.getByRole("tooltip").filter({ hasText: "重新编辑" })).toBeVisible();
  await article.getByRole("button", { name: "重新生成", exact: true }).hover();
  await expect(page.getByRole("tooltip").filter({ hasText: "重新生成" })).toBeVisible();
  const references = article.getByRole("button", { name: /查看参考图片/ });
  await expect(references).toHaveCount(2);
  for (const [index, assetId] of input.referenceAssetIds.entries()) {
    await expect(references.nth(index).locator("img")).toHaveAttribute(
      "src",
      `/api/v1/image-assets/${assetId}/content?thumbnail=1`,
    );
  }
  await expect(article.locator(".generation-results img")).toHaveAttribute(
    "src",
    `/api/v1/image-assets/${job.items[0]?.output_asset_id}/content`,
  );
});

test("edit directly restores the original references and parameters over an existing draft", async ({
  page,
}) => {
  const { input } = await historyFixture(page);
  const edit = page.getByRole("button", { name: "重新编辑", exact: true });
  await edit.click();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue(input.prompt);
  await expect(page.locator(".reference-tile")).toHaveCount(2);
  await page.getByRole("button", { name: "更多", exact: true }).click();
  await expect(page.getByRole("radio", { name: "高", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("button", { name: /创作模型/ })).toContainText(input.model);
  await page.getByLabel("提示词", { exact: true }).fill("我的新草稿");
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "替换当前草稿？", exact: true });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue(input.prompt);
});

test("edited history references and prompt survive all model switches", async ({ page }) => {
  const { input } = await historyFixture(page);
  await page.getByRole("button", { name: "重新编辑", exact: true }).click();
  const composer = page.getByRole("region", { name: "创作设置", exact: true });
  const reference = composer.locator(".reference-tile img").first();
  const source = await reference.getAttribute("src");
  for (const model of ["nano-banana-2.1", "gpt-image-2", "gpt-image-2.5"]) {
    await page.getByRole("button", { name: /创作模型/ }).click();
    await page.getByRole("option", { name: model, exact: true }).click();
    await expect(page.getByLabel("提示词", { exact: true })).toHaveValue(input.prompt);
    await expect(reference).toHaveAttribute("src", source ?? "");
    await expect(composer.getByRole("radio", { name: "3:4", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: "1K", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  }
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "nano-banana-2.1", exact: true }).click();
  await page.getByRole("radio", { name: "4K", exact: true }).click();
  await page.getByRole("button", { name: /创作模型/ }).click();
  await page.getByRole("option", { name: "gpt-image-2.5", exact: true }).click();
  await expect(page.getByRole("radio", { name: "4K", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue(input.prompt);
  await expect(reference).toHaveAttribute("src", source ?? "");
});

test("regenerate submits the original snapshot once and leaves the composer draft intact", async ({
  page,
}) => {
  const { input } = await historyFixture(page);
  let requests = 0;
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    requests++;
    expect(route.request().postDataJSON()).toEqual(input);
    await route.fulfill({ status: 202, json: { id: crypto.randomUUID(), replayed: false } });
  });
  await page.getByLabel("提示词", { exact: true }).fill("不要覆盖我的草稿");
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "重新生成这张图片？", exact: true });
  await expect(confirm).toBeVisible();
  await expect(confirm.locator(".confirm-dialog__content")).toHaveText("本次消耗 20 积分");
  // The panel is a borderless black sheet on a blurred, veiled page, and both
  // the dismiss action and the corner close glyph read as white on it.
  await expect(confirm).toHaveCSS("border-top-width", "0px");
  await expect(confirm).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(confirm.locator(".confirm-dialog__content")).toHaveCSS(
    "color",
    "rgb(184, 184, 192)",
  );
  await expect(confirm.getByRole("button", { name: "取消", exact: true })).toHaveCSS(
    "color",
    "rgb(184, 184, 192)",
  );
  const closeRegenerate = confirm.getByRole("button", {
    name: "关闭重新生成确认",
    exact: true,
  });
  await expect(closeRegenerate).toHaveCSS("color", "rgb(168, 168, 176)");
  await expect(closeRegenerate).toHaveCSS("border-radius", "50%");
  expect(requests).toBe(0);
  await confirm.getByRole("button", { name: "取消", exact: true }).click();
  await expect(confirm).not.toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await confirm.getByRole("button", { name: "确认", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue("不要覆盖我的草稿");
});

test("an uncertain history submission exposes the same pending request in the composer", async ({
  page,
}) => {
  await historyFixture(page);
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await page
    .getByRole("dialog", { name: "重新生成这张图片？", exact: true })
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "确认上次提交", exact: true })).toBeEnabled();
  await expect(page.getByLabel("重新生成", { exact: true })).toBeDisabled();
});

test("legacy history reads the original task snapshot before restoring a draft", async ({
  page,
}) => {
  const { job, input } = await historyFixture(page);
  let details = 0;
  await page.route("**/api/v1/image-tasks**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith(job.id)) {
      details++;
      return route.fulfill({ json: job });
    }
    await route.fulfill({ json: { data: [{ ...job, input: undefined }] } });
  });
  await page.reload();
  await page.getByRole("button", { name: "重新编辑", exact: true }).click();
  await expect(page.getByLabel("提示词", { exact: true })).toHaveValue(input.prompt);
  expect(details).toBe(1);
  await expect(page.locator(".reference-tile")).toHaveCount(2);
});

test("legacy history without quality restores standard quality", async ({ page }) => {
  await historyFixture(page, null);
  await page.getByRole("button", { name: "重新编辑", exact: true }).click();
  await page.getByRole("button", { name: "更多", exact: true }).click();
  await expect(page.getByRole("radio", { name: "标准", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("text-only tasks do not show generated images as prompt references", async ({ page }) => {
  const { job } = await historyFixture(page, "high", false);
  const article = page.locator(".generation-job").first();
  await expect(article.locator(".generation-results img")).toHaveCount(1);
  await expect(article.getByLabel("任务参考图", { exact: true })).toHaveCount(0);
  await expect(article.locator(".history-prompt img")).toHaveCount(0);
  expect(job.input.referenceAssetIds).toEqual([]);
});

test("bulk download uses fresh signed originals and creates one ZIP before task edit actions", async ({
  page,
}) => {
  const { job } = await historyFixture(page, "high", false, 3);
  const originals: string[] = [];
  await page.route("**/api/v1/image-assets/*/delivery", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const base = `https://assets.example.test/${id}`;
    return route.fulfill({
      json: {
        id,
        delivery: {
          url: `${base}.preview.webp`,
          thumbnail_url: `${base}.thumbnail.webp`,
          download_url: `${base}.png?variant=download`,
          expires_at: Math.floor(Date.now() / 1000) + 300,
        },
      },
    });
  });
  await page.route("https://assets.example.test/**", (route) => {
    if (route.request().resourceType() !== "image") originals.push(route.request().url());
    return route.fulfill({
      contentType: "image/png",
      body: png,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  const button = page.getByRole("button", { name: "下载全部", exact: true });
  await expect(button).toBeVisible();
  await button.hover();
  await expect(page.getByRole("tooltip").filter({ hasText: "3 张" })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip").filter({ hasText: "3 张" })).toBeHidden();
  await button.focus();
  await expect(page.getByRole("tooltip").filter({ hasText: "3 张" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip").filter({ hasText: "3 张" })).toBeHidden();
  await expect(page.locator(".history-task-actions").getByRole("button").first()).toHaveText(
    "下载全部",
  );
  const pending = page.waitForEvent("download");
  await button.click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(`图片创作-${job.id}.zip`);
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  if (!path) throw new Error("Download missing");
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(bytes.includes(Buffer.from("01-生成图片.png"))).toBe(true);
  expect(bytes.includes(Buffer.from("03-生成图片.png"))).toBe(true);
  expect(originals).toHaveLength(3);
  expect(originals.every((url) => url.endsWith(".png?variant=download"))).toBe(true);
  await expect(button).toBeEnabled();
});

test("bulk download failure shows a toast and allows retry without downloading a partial ZIP", async ({
  page,
}) => {
  await historyFixture(page, "high", false, 2);
  await page.route("**/api/v1/image-assets/*/delivery", (route) =>
    route.fulfill({ status: 403, json: { message: "forbidden" } }),
  );
  let downloads = 0;
  page.on("download", () => downloads++);
  const button = page.getByRole("button", { name: "下载全部", exact: true });
  await button.click();
  await expect(page.locator(".toast__title")).toHaveText("下载失败，请稍后重试或分别下载图片。");
  await expect(button).toBeEnabled();
  expect(downloads).toBe(0);
});

test("partially failed groups expose the successful count and unfinished groups hide bulk download", async ({
  page,
}) => {
  const { job } = await historyFixture(page, "high", false, 3);
  job.status = "partially_failed";
  const failed = job.items[1];
  if (!failed) throw new Error("Missing fixture item");
  failed.status = "failed";
  await page.reload();
  await expect(page.getByRole("button", { name: "下载已生成", exact: true })).toBeVisible();
  job.status = "running";
  await page.reload();
  await expect(page.locator(".generation-job")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /下载全部|下载已生成/ })).toHaveCount(0);
});

test("generated results stay separated from reference images by 24px", async ({ page }) => {
  await historyFixture(page, "high", true, 2);
  const gap = await page.locator(".generation-job").evaluate((article) => {
    const prompt = article.querySelector(".history-prompt");
    const results = article.querySelector(".generation-results");
    if (!prompt || !results) throw new Error("History content missing");
    return results.getBoundingClientRect().top - prompt.getBoundingClientRect().bottom;
  });
  expect(gap).toBe(24);
});
