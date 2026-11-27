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
  await page.locator(".account-menu").getByRole("button", { name: "设置", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "账户设置", exact: true });
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

test("Doubao copies the full authorization value on demand after reopening settings", async ({
  page,
}) => {
  await setup(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const fixtureKey = `lcb_img_${"A".repeat(43)}`;
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  let issued = false;
  let copyReads = 0;
  await page.route("**/api/v1/enterprise/image-api/key", (route) => {
    if (route.request().method() === "POST") {
      issued = true;
      return route.fulfill({ status: 201, json: apiFixture({ key: fixtureKey, expiresAt }) });
    }
    return route.fulfill({
      json: apiFixture(
        issued
          ? { expiresAt, lastFour: fixtureKey.slice(-4), copyable: true }
          : { expiresAt: null },
      ),
    });
  });
  await page.route("**/api/v1/enterprise/image-api/key/copy", (route) => {
    copyReads++;
    expect(route.request().method()).toBe("POST");
    return route.fulfill({ json: apiFixture({ key: fixtureKey }) });
  });
  await page.goto("/zh-CN/dashboard/commerce/create");
  const openConnections = async () => {
    await page.getByRole("button", { name: "账户菜单：settings-fixture", exact: true }).click();
    await page
      .locator(".account-menu")
      .getByRole("button", { name: "应用连接", exact: true })
      .click();
  };
  await openConnections();
  const settings = page.getByRole("dialog", { name: "账户设置", exact: true });
  const apps = settings.locator('section[aria-label="应用"]');
  const resources = settings.locator('section[aria-label="技能与密钥"]');
  const manage = resources.getByRole("button", { name: "管理 Key", exact: true });
  await expect(resources.getByRole("link", { name: "下载技能" })).toHaveAttribute(
    "href",
    "/integrations/lycobo-image.zip",
  );
  await settings.getByRole("button", { name: "配置连接", exact: true }).click();
  await apps.getByRole("button", { name: "获取请求头值", exact: true }).click();
  await expect(manage).toHaveAttribute("aria-expanded", "true");
  await settings.getByRole("button", { name: "生成 Key", exact: true }).click();
  const copy = apps.getByRole("button", { name: "复制请求头值", exact: true });
  await copy.click();
  await expect(manage).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(`Bearer ${fixtureKey}`);
  await expect(settings.getByText(fixtureKey, { exact: false })).toHaveCount(0);
  await expect(resources.locator(".settings-masked-key")).toHaveText("lcb_img_********AAAA");

  await settings.getByRole("button", { name: "关闭账户设置", exact: true }).click();
  await expect(settings).toBeHidden();
  await openConnections();
  await settings.getByRole("button", { name: "配置连接", exact: true }).click();
  await expect(resources.locator(".settings-masked-key")).toHaveText("lcb_img_********AAAA");
  expect(copyReads).toBe(1);
  await page.evaluate(() => navigator.clipboard.writeText("fixture placeholder"));
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(`Bearer ${fixtureKey}`);
  expect(copyReads).toBe(2);
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
  // 会话结束后，受保护的创作页转到全屏登录页。
  await expect(page.getByRole("heading", { name: "登录 Lycobo", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  expect(requests).toEqual([
    { currentPassword: "current-password-123", newPassword: "new-password-12345" },
  ]);
});
