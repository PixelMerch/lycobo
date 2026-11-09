import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function setup(page: Page, role = "admin") {
  await mockImageApi(page);
  let signedIn = true;
  const identity = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    uid: "0123456789",
    role,
    account: "settings-fixture",
  };
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: apiFixture(identity, signedIn ? 200 : 401),
    }),
  );
  return () => {
    signedIn = false;
  };
}
async function openSettings(page: Page) {
  await page.goto("/commerce/create");
  if ((page.viewportSize()?.width ?? 1440) < 768)
    await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await page.getByRole("button", { name: "账户菜单：settings-fixture", exact: true }).click();
  await page.getByRole("menuitem", { name: "设置", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "设置", exact: true });
  await expect(settings).toBeVisible();
  await expect(page.locator(".modal__container").filter({ has: settings })).not.toHaveAttribute(
    "data-entering",
    "true",
  );
  return settings;
}
for (const width of [1440, 390]) {
  test(`settings separates identity and security from billing at ${width}px`, async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    const settings = await openSettings(page);
    await expect(page.getByRole("dialog", { name: "积分与账单", exact: true })).toHaveCount(0);
    await expect(settings.getByRole("tab")).toHaveText(["个人资料", "登录与安全", "企业成员"]);
    await expect(settings.getByRole("button", { name: "上传头像", exact: true })).toBeDisabled();
    await expect(settings.locator(".settings-hero-meta")).toContainText("UID 0123456789");
    await page.screenshot({ path: `/tmp/lycobo-settings-profile-${width}.png` });
    await settings.getByRole("tab", { name: "登录与安全", exact: true }).click();
    await expect(settings.getByRole("button", { name: "绑定微信", exact: true })).toBeDisabled();
    await settings.getByLabel("当前密码", { exact: true }).focus();
    await expect(settings.getByLabel("当前密码", { exact: true })).toHaveCSS(
      "outline-color",
      "rgb(161, 161, 170)",
    );
    await page.screenshot({ path: `/tmp/lycobo-settings-security-${width}.png` });
    await settings.getByRole("tab", { name: "企业成员", exact: true }).click();
    await expect(settings.getByRole("button", { name: "添加子账号", exact: true })).toBeDisabled();
    await page.screenshot({ path: `/tmp/lycobo-settings-${width}.png` });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "账户菜单：settings-fixture", exact: true }),
    ).toBeFocused();
  });
}
test("ordinary members do not see enterprise management", async ({ page }) => {
  await setup(page, "member");
  const settings = await openSettings(page);
  await expect(settings.getByRole("tab")).toHaveText(["个人资料", "登录与安全"]);
  await expect(settings.getByRole("button", { name: "添加子账号", exact: true })).toHaveCount(0);
});

test("password validation and failed credentials never clear a working session", async ({
  page,
}) => {
  await setup(page);
  let submissions = 0;
  await page.route("**/api/v1/auth/password", (route) => {
    submissions++;
    return route.fulfill({
      status: 401,
      json: { ...apiFixture({}, 401), message: "当前密码错误" },
    });
  });
  const settings = await openSettings(page);
  await settings.getByRole("tab", { name: "登录与安全", exact: true }).click();
  await settings.getByLabel("当前密码", { exact: true }).fill("incorrect-current-password");
  await settings.getByLabel("新密码", { exact: true }).fill("new-password-12345");
  await settings.getByLabel("确认新密码", { exact: true }).fill("mismatched-password");
  await settings.getByRole("button", { name: "保存新密码", exact: true }).click();
  await expect(settings.getByText("两次输入的新密码不一致", { exact: true })).toBeVisible();
  expect(submissions).toBe(0);
  await settings.getByLabel("确认新密码", { exact: true }).fill("new-password-12345");
  await settings.getByRole("button", { name: "保存新密码", exact: true }).click();
  await expect(page.getByText("当前密码错误", { exact: true })).toBeVisible();
  expect(submissions).toBe(1);
  await expect(settings).toBeVisible();
});

test("successful password change sends the real contract and ends the client session", async ({
  page,
}) => {
  const signOut = await setup(page);
  const requests: unknown[] = [];
  await page.route("**/api/v1/auth/password", (route) => {
    requests.push(route.request().postDataJSON());
    signOut();
    return route.fulfill({ json: apiFixture({}) });
  });
  const settings = await openSettings(page);
  await settings.getByRole("tab", { name: "登录与安全", exact: true }).click();
  await settings.getByLabel("当前密码", { exact: true }).fill("current-password-123");
  await settings.getByLabel("新密码", { exact: true }).fill("new-password-12345");
  await settings.getByLabel("确认新密码", { exact: true }).fill("new-password-12345");
  await settings.getByRole("button", { name: "保存新密码", exact: true }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toBeVisible();
  expect(requests).toEqual([
    { currentPassword: "current-password-123", newPassword: "new-password-12345" },
  ]);
});
