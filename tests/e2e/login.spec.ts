import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
});

test("header login opens account/password dialog and validates without faking authentication", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const entry = page.getByRole("button", { name: "登录领积分", exact: true });
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "欢迎使用 Lycobo" });
  await expect(dialog).toBeVisible();
  // Enterprise account/password is the default login method.
  const account = dialog.getByRole("textbox", { name: "企业账号" });
  const password = dialog.getByLabel("密码", { exact: true });
  await expect(account).toBeFocused();
  await expect(dialog.getByRole("status", { name: "扫码登录暂未开放" })).toHaveCount(0);
  // No coloured top strip: the panel is white edge to edge.
  await expect(dialog.locator(".login-banner")).toHaveCount(0);
  await expect(dialog.locator(".login-panel")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(dialog.getByRole("button", { name: "关闭登录" })).toBeVisible();
  await expect(dialog.locator(".login-content")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect
    .poll(() =>
      dialog.locator(".login-visual > img").evaluate((node: HTMLImageElement) => node.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() => dialog.locator(".login-panel").evaluate((node) => getComputedStyle(node).transform))
    .toBe("none");
  await page.screenshot({ path: "/tmp/lycoboai-login-enterprise-desktop.png" });
  await expect(account).toHaveCSS("border-top-width", "0px");
  await expect(account).toHaveCSS("outline-style", "none");
  await expect(account).toHaveCSS("box-shadow", "rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(dialog.getByText("请输入企业账号", { exact: true })).toBeVisible();
  await expect(dialog.getByText("请输入密码", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "登录", exact: true })).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await account.fill("merchant-demo");
  await password.fill("example-password");
  await expect(password).toHaveCSS("border-top-width", "0px");
  await expect(dialog.locator(".login-input-group")).toHaveCSS("border-top-width", "0px");
  await expect(dialog.locator(".login-input-group")).toHaveCSS(
    "box-shadow",
    "rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset",
  );
  await expect(password).toHaveAttribute("type", "password");
  await dialog.getByRole("button", { name: "显示密码" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await dialog.getByRole("button", { name: "隐藏密码" }).click();
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".toast-region")).toContainText(
    "企业账号登录服务暂未开放，请稍后再试。",
  );
  await expect(dialog.locator(".login-error")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/lycoboai-login-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
  await entry.click();
  await expect(account).toBeFocused();
  await expect(dialog.getByLabel("密码", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: "通过微信扫码登录", exact: true }).click();
  await expect(dialog.getByRole("status", { name: "扫码登录暂未开放" })).toBeVisible();
});

test("switching login methods keeps the dialog height and uses borderless fields with one focus indicator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "欢迎使用 Lycobo" });
  await expect(dialog).toBeVisible();
  const heights: number[] = [];
  for (const label of ["手机号登录", "企业账号登录", "通过微信扫码登录"]) {
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog.locator(".login-secondary-methods").getByRole("button")).toHaveCount(2);
    await expect(
      dialog.locator(".login-secondary-methods").getByRole("button", { name: label, exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        heights.push(Math.round(box?.height ?? 0));
        return heights.at(-1);
      })
      .toBeGreaterThan(0);
  }
  expect(new Set(heights).size).toBe(1);
  // The method body is tall enough for every method, so nothing scrolls or clips.
  expect(
    await dialog.locator(".login-body").evaluate((node) => node.scrollHeight - node.clientHeight),
  ).toBe(0);
  // Grouped fields keep a single border: the shell, never an inner outline.
  const grouped = dialog.locator(".login-input-group");
  await dialog.getByRole("button", { name: "企业账号登录", exact: true }).click();
  await dialog.getByLabel("密码", { exact: true }).focus();
  await expect(grouped).toHaveCSS("border-top-width", "0px");
  await expect(grouped.locator("input")).toHaveCSS("outline-style", "none");
  await expect(grouped.locator("input")).toHaveCSS("border-top-width", "0px");
  await dialog.getByRole("button", { name: "手机号登录", exact: true }).click();
  await dialog.getByLabel("验证码", { exact: true }).focus();
  await expect(grouped).toHaveCSS("border-top-width", "0px");
  await expect(grouped.locator("input")).toHaveCSS("outline-style", "none");
});

test("login panel animates open and close, and reduced motion skips the animation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const panel = page.locator(".login-panel");
  await expect(panel).toBeVisible();
  // The panel eases in from a slightly smaller, lower position.
  await expect
    .poll(async () => panel.evaluate((node) => getComputedStyle(node).transform))
    .toBe("none");
  await page.getByRole("dialog").getByRole("button", { name: "关闭登录" }).click();
  // Closing animates before unmounting, so the dialog is not removed immediately.
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile protected-route login closes back to the homepage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/create");
  await expect(page.locator(".composer-panel")).toHaveCount(0);
  const dialog = page.getByRole("dialog", { name: "欢迎使用 Lycobo" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => (await dialog.boundingBox())?.width ?? Infinity)
    .toBeLessThanOrEqual(366.5);
  await page.screenshot({ path: "/tmp/lycoboai-login-mobile.png" });
  await dialog.getByRole("button", { name: "关闭登录" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});

test("phone login validates the phone and code without pretending to send SMS", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "手机号登录", exact: true }).click();
  const phone = dialog.getByLabel("手机号", { exact: true });
  await expect(phone).toBeVisible();
  await page.screenshot({ path: "/tmp/lycoboai-login-phone-desktop.png" });
  await phone.fill("123");
  await dialog.getByRole("button", { name: "发送验证码" }).click();
  await expect(dialog.getByText("请输入有效的中国大陆手机号", { exact: true })).toBeVisible();
  await phone.fill("13800138000");
  await dialog.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.locator(".toast-region")).toContainText("短信验证码服务暂未开放");
  await dialog.getByLabel("验证码", { exact: true }).fill("123456");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".toast-region")).toContainText("手机号登录服务暂未开放");
  await dialog.getByRole("button", { name: "通过微信扫码登录", exact: true }).click();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog.getByRole("status", { name: "扫码登录暂未开放" })).toBeVisible();
});

test("enterprise login updates the header, refreshes its session and clears the user on logout", async ({
  page,
}) => {
  const user = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    role: "member",
    account: "merchant-fixture",
  };
  let loggedIn = false;
  await page.route("**/api/v1/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/enterprise/login")) {
      expect(route.request().postDataJSON()).toEqual({
        account: "merchant-fixture",
        password: "fixture-password",
      });
      loggedIn = true;
      return route.fulfill({
        json: apiFixture({
          user,
          accessToken: "fixture-token",
          tokenType: "Bearer",
          expiresIn: 900,
        }),
      });
    }
    if (path.endsWith("/logout")) {
      loggedIn = false;
      return route.fulfill({ json: apiFixture({}) });
    }
    return route.fulfill({
      status: loggedIn ? 200 : 401,
      json: apiFixture(loggedIn ? user : {}, loggedIn ? 200 : 401),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("企业账号", { exact: true }).fill("merchant-fixture");
  await dialog.getByLabel("密码", { exact: true }).fill("fixture-password");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".account-trigger")).toHaveAccessibleName("账户菜单：merchant-fixture");
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => /token|jwt|password/i.test(key)),
    ),
  ).toBe(false);
  await page.reload();
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toBeVisible();
});
