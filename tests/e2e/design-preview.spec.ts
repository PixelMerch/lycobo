import { expect, test } from "@playwright/test";

test("global header controls stay aligned when hovered", async ({ page }) => {
  for (const width of [320, 390, 768, 1920]) {
    await page.setViewportSize({ width, height: 928 });
    for (const path of ["/", "/canvas?task=demo-skin"]) {
      await page.goto(path);
      const controls = [
        page.getByRole("button", { name: "全部任务 4", exact: true }),
        page.getByRole("button", { name: /^通知，/ }),
        page.getByRole("button", { name: "个人账户", exact: true }),
      ];
      await page.mouse.move(0, 0);
      const initial = await Promise.all(controls.map((control) => control.boundingBox()));
      for (const control of controls) {
        await control.hover();
        const hovered = await Promise.all(controls.map((item) => item.boundingBox()));
        expect(hovered).toEqual(initial);
      }
      for (const box of initial) {
        expect(box).not.toBeNull();
        if (!box) throw new Error("Header control is missing");
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      const task = controls[0];
      if (!task) throw new Error("Task control is missing");
      const icon = await task.locator("svg").boundingBox();
      const badge = await task.locator(".count-badge").boundingBox();
      expect(icon).not.toBeNull();
      expect(badge).not.toBeNull();
      if (!icon || !badge) throw new Error("Task contents are missing");
      expect(Math.abs(icon.y + icon.height / 2 - badge.y - badge.height / 2)).toBeLessThan(1);
      expect(icon.x + icon.width).toBeLessThan(badge.x);
    }
  }
});

test("preview queues independent tasks, keeps drafts across navigation and completion does not redirect", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: /做同款/ })
    .first()
    .click();
  await page.getByRole("button", { name: "生成图片" }).click();
  await expect(page.getByRole("status")).toContainText("可以继续创作");
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("textbox", { name: "描述想要的画面" }).fill("第二件商品的草稿");
  await page.getByRole("link", { name: "任务中心", exact: true }).click();
  await expect(page.getByText("5 个任务")).toBeVisible();
  await page.getByRole("button", { name: "全部任务 5", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await page.getByRole("button", { name: "关闭任务抽屉" }).click();
  await expect(page.getByRole("button", { name: "通知，1 个新结果" })).toBeVisible();
  await page.getByRole("button", { name: "新结果", exact: true }).click();
  await expect(page.getByText("1 个任务")).toBeVisible();
  await page.getByRole("link", { name: "创作工作室", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "描述想要的画面" })).toHaveValue(
    "第二件商品的草稿",
  );
});

test("opening a result marks it read and supports local edit and download", async ({ page }) => {
  await page.goto("/canvas?task=demo-skin");
  await expect(page.getByRole("button", { name: "通知，0 个新结果" })).toBeVisible();
  await page.getByRole("button", { name: "调整图片", exact: true }).click();
  await page.getByRole("slider", { name: "亮度" }).fill("120");
  const pendingDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载图片", exact: true }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe("lycoboai-夏日护肤.png");
  expect(await download.failure()).toBeNull();
  await page.getByRole("button", { name: "全部任务 4" }).click();
  await page.getByRole("dialog", { name: "全部任务" }).press("Escape");
  await expect(page.getByRole("dialog", { name: "全部任务" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "全部任务 4" })).toBeFocused();
});

test("preview pages fit narrow viewports and retain task navigation", async ({ page }) => {
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/tasks", "/canvas?task=demo-skin"]) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "全部任务 4" })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  }
});

test("generation settings survive navigation and are captured per task; account popover restores focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "香蕉 2.1版 模型", exact: true }).click();
  await page.getByRole("option", { name: "Seedream 5.0 P", exact: true }).click();
  await page.getByRole("button", { name: "图像设置", exact: true }).click();
  await page.getByRole("button", { name: "比例 3:4", exact: true }).click();
  await page.getByRole("button", { name: "分辨率 4K", exact: true }).click();
  await page.getByRole("button", { name: "生成张数 3张", exact: true }).click();
  await page.getByRole("dialog", { name: "图像设置", exact: true }).press("Escape");
  await page
    .getByRole("link", { name: /做同款/ })
    .first()
    .click();
  await page.getByRole("button", { name: "生成图片" }).click();
  await page.getByRole("button", { name: "图像设置", exact: true }).click();
  await page.getByRole("button", { name: "分辨率 1K", exact: true }).click();
  await page.getByRole("dialog", { name: "图像设置", exact: true }).press("Escape");
  await page.getByRole("status").getByRole("link", { name: "查看", exact: true }).click();
  await expect(page.getByText("Seedream 5.0 P · 3:4 · 4K · 3张", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "图像设置", exact: true })).toContainText(
    "3:4 · 1K · 3张",
  );
  await page.getByRole("button", { name: "个人账户" }).click();
  const account = page.getByRole("dialog", { name: "个人账户", exact: true });
  await expect(account.getByText("未登录", { exact: true })).toBeVisible();
  await expect(account.getByRole("button", { name: "购买积分" })).toBeDisabled();
  await account.press("Escape");
  await expect(page.getByRole("button", { name: "个人账户" })).toBeFocused();
});

test("references enforce five-image limit, support mentions and snapshot submitted images", async ({
  page,
}) => {
  await page.goto("/");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const files = Array.from({ length: 5 }, (_, index) => ({
    name: `reference-${index}.png`,
    mimeType: "image/png",
    buffer: png,
  }));
  await page.getByLabel("上传参考图", { exact: true }).setInputFiles(files);
  await expect(page.getByRole("alert")).toContainText("最多添加 5 张参考图");
  await expect(
    page.getByRole("button", { name: "添加参考图，最多5张", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("上传参考图", { exact: true })).toBeDisabled();
  await expect(page.locator(".reference-tile")).toHaveCount(5);
  await expect(page.locator(".reference-strip")).not.toContainText("/5");
  const prompt = page.getByRole("textbox", { name: "描述想要的画面" });
  await prompt.fill("参考@");
  await page.getByRole("option", { name: "图片2", exact: true }).click();
  await expect(prompt).toHaveValue("参考 ");
  await expect(prompt).toBeFocused();
  await expect(page.locator(".prompt-mention-tag")).toHaveText("图片2");
  await expect(page.locator(".prompt-mention-tag .reference-thumbnail")).toBeVisible();
  const tagBox = await page.locator(".prompt-mention-tag").boundingBox();
  const inputBox = await prompt.boundingBox();
  if (!tagBox || !inputBox) throw new Error("Reference tag or prompt is missing");
  expect(inputBox.x).toBeGreaterThanOrEqual(tagBox.x + tagBox.width);
  expect(Math.abs(inputBox.y - tagBox.y)).toBeLessThan(2);
  await prompt.pressSequentially("保留商品细节");
  await expect(prompt).toHaveValue("参考 保留商品细节");
  await prompt.pressSequentially("@");
  await expect(page.getByRole("option", { name: "图片2", exact: true })).toBeDisabled();
  await page.getByRole("dialog", { name: "选择引用图片" }).press("Escape");
  await prompt.press("Backspace");
  await page.getByRole("button", { name: "移除图片2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "添加参考图，最多5张", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("上传参考图", { exact: true })).toBeEnabled();
  await expect(prompt).toHaveValue("参考 保留商品细节");
  await expect(page.locator(".prompt-mention-tag")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "移除图片3", exact: true })).toBeAttached();
  await prompt.fill("参考@");
  await page.getByRole("option", { name: "图片3", exact: true }).click();
  await page.getByRole("button", { name: "生成图片", exact: true }).click();
  await page.getByRole("button", { name: "移除图片3", exact: true }).click();
  await page.getByRole("status").getByRole("link", { name: "查看", exact: true }).click();
  await expect(
    page
      .locator(".history-reference")
      .getByRole("img", { name: "图片3 · reference-1.png", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-prompt")).toHaveText("@图片3 参考");
});

test("reference tags deduplicate pasted mentions and can be removed without deleting images", async ({
  page,
}) => {
  await page.goto("/");
  const prompt = page.getByRole("textbox", { name: "描述想要的画面" });
  await prompt.fill("@图片1 @图片1 保留商品细节");
  await expect(page.locator(".prompt-mention-tag")).toHaveCount(1);
  await expect(prompt).toHaveValue("保留商品细节");
  await expect(page.getByRole("button", { name: "取消引用图片1", exact: true })).toHaveCount(0);
  await prompt.press("ControlOrMeta+Home");
  await prompt.press("Backspace");
  await expect(page.locator(".prompt-mention-tag")).toHaveCount(0);
  await expect(page.locator(".reference-tile")).toHaveCount(1);
  await expect(prompt).toHaveValue("保留商品细节");
  await prompt.pressSequentially("@");
  await expect(page.getByRole("option", { name: "图片1", exact: true })).toBeEnabled();
  await page.getByRole("option", { name: "图片1", exact: true }).click();
  await expect(prompt).toHaveValue(" 保留商品细节");
  expect(await prompt.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(1);
  await prompt.pressSequentially("继续描述");
  await expect(prompt).toHaveValue(" 继续描述保留商品细节");
});
