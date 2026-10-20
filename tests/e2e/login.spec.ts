import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("header login opens account/password dialog and validates without faking authentication", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const entry = page.getByRole("button", { name: "登录领积分", exact: true });
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "欢迎使用 lycoboai" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("手机号", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/lycoboai-login-phone-desktop.png" });
  await dialog.getByRole("radio", { name: "企业账号", exact: true }).click();
  const account = dialog.getByRole("textbox", { name: "企业账号" });
  const password = dialog.getByLabel("密码", { exact: true });
  await expect(account).toBeFocused();
  await expect(account).toHaveCSS("border-top-width", "1px");
  await expect(account).toHaveCSS("outline-style", "none");
  await expect(account).toHaveCSS("box-shadow", "none");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(dialog.getByText("请输入企业账号", { exact: true })).toBeVisible();
  await expect(dialog.getByText("请输入密码", { exact: true })).toBeVisible();
  await account.fill("merchant-demo");
  await password.fill("example-password");
  await expect(password).toHaveCSS("border-top-width", "0px");
  await expect(dialog.locator(".login-input-group")).toHaveCSS("border-top-width", "1px");
  await expect(dialog.locator(".login-input-group")).toHaveCSS("box-shadow", "none");
  await expect(password).toHaveAttribute("type", "password");
  await dialog.getByRole("button", { name: "显示密码" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await dialog.getByRole("button", { name: "隐藏密码" }).click();
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("企业账号登录服务暂未开放，请稍后再试。");
  await page.screenshot({ path: "/tmp/lycoboai-login-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
  await entry.click();
  await expect(dialog.getByLabel("手机号", { exact: true })).toBeVisible();
  await dialog.getByRole("radio", { name: "企业账号", exact: true }).click();
  await expect(dialog.getByLabel("密码", { exact: true })).toHaveValue("");
});

test("switching login methods keeps the dialog height and draws a single focus border", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "欢迎使用 lycoboai" });
  await expect(dialog).toBeVisible();
  const heights: number[] = [];
  for (const label of ["手机号", "企业账号", "微信扫码"]) {
    await dialog.getByRole("radio", { name: label, exact: true }).click();
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
  await dialog.getByRole("radio", { name: "企业账号", exact: true }).click();
  await dialog.getByLabel("密码", { exact: true }).focus();
  await expect(grouped).toHaveCSS("border-top-width", "1px");
  await expect(grouped.locator("input")).toHaveCSS("outline-style", "none");
  await expect(grouped.locator("input")).toHaveCSS("border-top-width", "0px");
  await dialog.getByRole("radio", { name: "手机号", exact: true }).click();
  await dialog.getByLabel("验证码", { exact: true }).focus();
  await expect(grouped).toHaveCSS("border-top-width", "1px");
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

test("mobile login closes without losing the current creation draft", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留当前创作草稿");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "欢迎使用 lycoboai" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => (await dialog.boundingBox())?.width ?? Infinity)
    .toBeLessThanOrEqual(366.5);
  await page.screenshot({ path: "/tmp/lycoboai-login-mobile.png" });
  await dialog.getByRole("button", { name: "关闭登录" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(prompt).toHaveValue("保留当前创作草稿");
});

test("phone login validates the phone and code without pretending to send SMS", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const phone = dialog.getByLabel("手机号", { exact: true });
  await expect(phone).toBeVisible();
  await phone.fill("123");
  await dialog.getByRole("button", { name: "发送验证码" }).click();
  await expect(dialog.getByText("请输入有效的中国大陆手机号", { exact: true })).toBeVisible();
  await phone.fill("13800138000");
  await dialog.getByRole("button", { name: "发送验证码" }).click();
  await expect(dialog.getByRole("alert")).toContainText("短信验证码服务暂未开放");
  await dialog.getByLabel("验证码", { exact: true }).fill("123456");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("手机号登录服务暂未开放");
  await dialog.getByRole("button", { name: "通过微信扫码登录", exact: true }).click();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog.getByRole("status", { name: "扫码登录暂未开放" })).toBeVisible();
});
