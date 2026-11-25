import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi, mockPasswordTurnstile } from "./image-api-fixture";

test("login returns to the target and logout keeps the draft without a document reload", async ({
  page,
}) => {
  await mockImageApi(page);
  const user = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    role: "member",
    account: "history-fixture",
  };
  let loggedIn = false;
  let signedOut = false;
  let sessionRequests = 0;
  let imageRequestsAfterLogout = 0;
  await page.route("**/api/v1/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/enterprise/login")) {
      loggedIn = true;
      return route.fulfill({
        json: apiFixture({ user, accessToken: "fixture", tokenType: "Bearer", expiresIn: 900 }),
      });
    }
    if (path.endsWith("/logout")) {
      loggedIn = false;
      signedOut = true;
      return route.fulfill({ json: apiFixture({}) });
    }
    return route.fulfill({
      status: loggedIn ? 200 : 401,
      json: apiFixture(loggedIn ? user : {}, loggedIn ? 200 : 401),
    });
  });
  await page.route("**/api/v1/image-session", (route) => {
    sessionRequests++;
    if (signedOut) imageRequestsAfterLogout++;
    return route.fulfill({
      status: loggedIn ? 200 : 401,
      json: loggedIn
        ? apiFixture(user)
        : {
            request_id: crypto.randomUUID(),
            code: 40100,
            message: "请先登录",
            data: {},
            error: { code: "UNAUTHORIZED" },
          },
    });
  });
  const job = {
    id: crypto.randomUUID(),
    public_id: "W01ABCDEF",
    organization_id: user.organizationId,
    user_id: user.userId,
    model: "gpt-image-2",
    prompt: "登录自动显示的历史记录",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "failed",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    items: [],
  };
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: loggedIn ? [job] : [] }) }),
  );
  await page.goto("/commerce/create");
  await expect(page.locator(".login-page")).toBeVisible();
  await expect(page.locator(".composer-panel")).toHaveCount(0);
  expect(sessionRequests).toBe(0);
  const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  const initialDocument = await page.evaluate(() => performance.timeOrigin);
  const dialog = page.locator(".login-page");
  await dialog.getByRole("button", { name: "企业账号登录", exact: true }).click();
  await dialog.getByLabel("企业账号", { exact: true }).fill(user.account);
  await dialog.getByLabel("密码", { exact: true }).fill("fixture-password");
  await dialog.getByRole("button", { name: "登录企业账号", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".account-trigger")).toHaveAccessibleName(`账户菜单：${user.account}`);
  await expect(page.locator(".generation-job")).toContainText(job.prompt);
  await expect(page.getByText("登录后查看生成记录", { exact: true })).toHaveCount(0);
  await prompt.fill("登录后的创作草稿");
  expect(sessionRequests).toBeGreaterThan(0);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialDocument);
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await page.locator(".account-trigger").click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator(".generation-job")).toHaveCount(0);
  await expect(page.locator(".composer-panel")).toHaveCount(0);
  await dialog.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("登录后的创作草稿");
  expect(imageRequestsAfterLogout).toBe(0);
  await expect(page.getByText("登录已过期，请重新登录。", { exact: true })).toHaveCount(0);
});

for (const layout of ["desktop", "mobile"] as const) {
  test(`rejected login toast stays viewport-centered with ${layout} navigation`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await mockPasswordTurnstile(page);
    const message = "账号或密码错误";
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({ status: 401, json: apiFixture({}, 401) }),
    );
    await page.route("**/api/v1/auth/enterprise/login", (route) =>
      route.fulfill({
        status: 401,
        json: {
          request_id: crypto.randomUUID(),
          code: 40101,
          message,
          data: {},
          error: { code: "INVALID_CREDENTIALS" },
        },
      }),
    );
    if (layout === "mobile") await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "登录领积分", exact: true }).click();
    const dialog = page.locator(".login-page");
    await dialog.getByRole("button", { name: "企业账号登录", exact: true }).click();
    await dialog.getByLabel("企业账号", { exact: true }).fill("login-fixture");
    const password = dialog.getByLabel("密码", { exact: true });
    await password.fill("wrong-fixture-password");
    const submit = dialog.getByRole("button", { name: "登录企业账号", exact: true });
    await expect(dialog.locator(".login-face")).toHaveCSS("transform", "none");
    const before = await submit.boundingBox();
    await submit.click();
    await expect(page.locator(".toast-region")).toContainText(message);
    const toast = page.locator(".toast-region .toast").first();
    await expect
      .poll(async () => {
        const bounds = await toast.boundingBox();
        return bounds
          ? Math.abs(bounds.x + bounds.width / 2 - (page.viewportSize()?.width ?? 0) / 2)
          : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(1);
    await expect(dialog.getByText(message, { exact: true })).toHaveCount(0);
    await expect(dialog.locator(".login-error")).toHaveCount(0);
    await expect(password).toHaveValue("");
    await expect(password).toBeFocused();
    expect((await submit.boundingBox())?.y).toBeCloseTo(before?.y ?? 0, 0);
    // A second failed attempt still shows one toast, without stacking or moving the form.
    // The provider keeps an older toast mounted but hidden until it expires, so count only
    // the toasts it displays.
    await password.fill("another-wrong-password");
    const retried = page.waitForResponse("**/api/v1/auth/enterprise/login");
    await submit.click();
    await retried;
    const shown = page.locator('.toast-region .toast:not([data-hidden="true"])');
    await expect(shown).toHaveCount(1);
    await expect(shown).toContainText(message);
    await expect(dialog.getByText(message, { exact: true })).toHaveCount(0);
  });
}
