import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function signIn(page: Page, account: string) {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        uid: "0123456789",
        role: "admin",
        account,
      }),
    }),
  );
}

for (const width of [1440, 320]) {
  test(`account controls stay compact and Enter dismisses at ${width}px`, async ({ page }) => {
    const account = "account-fixture";
    await signIn(page, account);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/create");
    const draft = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
    await draft.fill("保留正在准备的商品图");
    const desktop = width >= 768;
    const openNavigation = async () => {
      if (!desktop) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    };
    await openNavigation();

    const label = `账户菜单：${account}`;
    const trigger = page.getByRole("button", { name: label, exact: true });
    const panel = page.getByRole("dialog", { name: label, exact: true });
    const settings = panel.getByRole("button", { name: "设置", exact: true });
    const works = panel.getByRole("button", { name: "个人作品", exact: true });
    await trigger.hover();
    await expect(panel).toBeHidden();

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(settings).toBeFocused();
    await works.hover();
    await page.keyboard.press("Enter");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("dialog", { name: "账户设置", exact: true })).toBeHidden();
    await expect(page.getByRole("dialog", { name: "素材库", exact: true })).toBeHidden();

    await trigger.click();
    await expect(panel.locator(".account-menu-details")).toContainText("UID 0123456789 · 管理员");
    await expect(panel).toHaveCSS("width", `${Math.min(280, width - 24)}px`);
    await expect(works).toHaveCSS("font-size", "12px");
    await expect(works).toHaveCSS("min-height", desktop ? "32px" : "44px");
    await expect(panel.getByRole("switch", { name: "桌面通知", exact: true })).toBeVisible();
    await expect(panel.getByRole("separator")).toHaveCount(1);
    const [panelBox, triggerBox] = await Promise.all([panel.boundingBox(), trigger.boundingBox()]);
    if (!panelBox || !triggerBox) throw new Error("Missing account panel or trigger");
    if (desktop) expect(panelBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height);
    else expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(triggerBox.y);
    await works.click();
    const library = page.getByRole("dialog", { name: "素材库", exact: true });
    await expect(library).toBeVisible();
    await expect(page).toHaveURL(/\/commerce\/create$/);
    await page.keyboard.press("Escape");
    await expect(library).toBeHidden();
    await expect(draft).toHaveValue("保留正在准备的商品图");

    await openNavigation();
    await trigger.focus();
    await page.keyboard.press("Space");
    await expect(settings).toBeFocused();
    await page.keyboard.press("Space");
    const center = page.getByRole("dialog", { name: "账户设置", exact: true });
    await expect(center).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(center).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("tapping the avatar opens the account controls", async ({ page }) => {
    await signIn(page, "touch-fixture");
    await page.goto("/commerce/create");
    await page.getByRole("button", { name: "打开导航", exact: true }).tap();
    const label = "账户菜单：touch-fixture";
    await page.getByRole("button", { name: label, exact: true }).tap();
    const panel = page.getByRole("dialog", { name: label, exact: true });
    await panel.getByRole("button", { name: "设置", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "账户设置", exact: true })).toBeVisible();
  });
});

/** 等页面收到指定事件后逐帧记录消息面板的位置和遮罩不透明度，直到面板卸载。 */
function sampleDrawer(page: Page, eventType: "click" | "keydown") {
  return page.evaluate(async (type) => {
    await new Promise<void>((resolve) =>
      document.addEventListener(type, () => resolve(), { once: true, capture: true }),
    );
    const samples: { left: number; opacity: string }[] = [];
    const start = performance.now();
    while (performance.now() - start < 800) {
      await new Promise(requestAnimationFrame);
      const panel = document.querySelector(".account-news-panel");
      const backdrop = document.querySelector(".account-news-backdrop");
      if (panel && backdrop)
        samples.push({
          left: panel.getBoundingClientRect().left,
          opacity: getComputedStyle(backdrop).opacity,
        });
      else if (samples.length) break;
    }
    return samples;
  }, eventType);
}

test("message drawer slides as solid glass and closes from where it is", async ({ page }) => {
  await signIn(page, "13800138000");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const opener = page.getByRole("button", { name: /消息（.*未读）/ });
  const panel = page.getByRole("dialog", { name: "消息中心" });
  // 遮罩全程保持不透明：面板是它的子元素，遮罩半透明会让毛玻璃透出清晰页面、结束时才突然变磨砂。
  const opening = sampleDrawer(page, "click");
  await opener.click();
  const enter = await opening;
  expect(enter.some((sample) => sample.left > 801)).toBe(true);
  expect(enter.at(-1)?.left).toBeCloseTo(800, 0);
  expect(enter.every((sample) => sample.opacity === "1")).toBe(true);
  // 关闭是看得见的滑出，不是跟着遮罩一起淡没。
  const closing = sampleDrawer(page, "keydown");
  await page.keyboard.press("Escape");
  const exit = await closing;
  expect(exit.some((sample) => sample.left > 900 && sample.left < 1440)).toBe(true);
  expect(exit.every((sample) => sample.opacity === "1")).toBe(true);
  await expect(panel).toBeHidden();

  // 进场停在 120ms 时关闭：从当前位置滑出，不先跳回完全打开的位置，也不瞬间消失。
  await opener.click();
  await expect(panel).toBeVisible();
  await page.evaluate(() => {
    const entering = document.querySelector(".account-news-content")?.getAnimations() ?? [];
    if (!entering.length) throw new Error("The drawer finished entering before the check");
    for (const animation of entering) {
      animation.pause();
      animation.currentTime = 120;
    }
  });
  const closingEarly = sampleDrawer(page, "keydown");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    for (const animation of document.querySelector(".account-news-content")?.getAnimations() ?? [])
      animation.play();
  });
  const early = await closingEarly;
  expect(early.some((sample) => sample.left < 1440)).toBe(true);
  expect(early.every((sample) => sample.left > 820)).toBe(true);
  await expect(panel).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await opener.click();
  await expect(panel).toHaveCSS("transition-duration", "0s");
  await expect(panel).toHaveCSS("translate", "none");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
