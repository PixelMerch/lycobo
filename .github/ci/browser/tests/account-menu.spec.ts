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
  test(`account controls fit the panel and Enter dismisses at ${width}px`, async ({ page }) => {
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
    await expect(works).toHaveCSS("font-size", "13px");
    await expect(works).toHaveCSS("min-height", desktop ? "38px" : "44px");
    await expect(panel.getByRole("switch", { name: "桌面通知", exact: true })).toHaveCount(0);
    expect(await panel.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
      await panel.evaluate((element) => element.clientWidth),
    );
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

for (const width of [1440, 390]) {
  test(`the bell toggles messages and an outside click dismisses them at ${width}px`, async ({
    page,
  }) => {
    await signIn(page, "messages-fixture");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/create");
    const opener = page.getByRole("button", { name: /^消息（/ });
    const panel = page.getByRole("dialog", { name: "消息中心", exact: true });
    await opener.click();
    await expect(panel).toBeVisible();
    await panel.getByRole("tab", { name: "更新通知", exact: true }).click();
    await expect(panel).toBeVisible();
    await opener.click();
    await expect(panel).toBeHidden();
    await expect(opener).toHaveAttribute("aria-expanded", "false");

    await opener.click();
    await expect(panel.getByRole("tab", { name: /^系统通知/, selected: true })).toBeVisible();
    const bounds = await panel.boundingBox();
    if (!bounds) throw new Error("Missing messages panel");
    await page.mouse.click(width / 2, Math.ceil(bounds.y + bounds.height) + 8);
    await expect(panel).toBeHidden();

    await opener.click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();
  });
}
