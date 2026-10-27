import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("login and logout synchronize mounted history without reloading or losing the draft", async ({
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
  let sessionRequests = 0;
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
      return route.fulfill({ json: apiFixture({}) });
    }
    return route.fulfill({
      status: loggedIn ? 200 : 401,
      json: apiFixture(loggedIn ? user : {}, loggedIn ? 200 : 401),
    });
  });
  await page.route("**/api/v1/image-session", (route) => {
    sessionRequests++;
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
  await page.goto("/create");
  await expect(page.getByText("登录后查看生成记录", { exact: true })).toBeVisible();
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("登录前编辑的草稿");
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("企业账号", { exact: true }).fill(user.account);
  await dialog.getByLabel("密码", { exact: true }).fill("fixture-password");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".account-trigger")).toHaveAccessibleName(`账户菜单：${user.account}`);
  await expect(page.locator(".generation-job")).toContainText(job.prompt);
  await expect(page.getByText("登录后查看生成记录", { exact: true })).toHaveCount(0);
  await expect(prompt).toHaveValue("登录前编辑的草稿");
  expect(sessionRequests).toBeGreaterThan(1);
  expect(navigations).toBe(0);
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await expect(page.getByText("登录后查看生成记录", { exact: true })).toBeVisible();
  await expect(page.locator(".generation-job")).toHaveCount(0);
  await expect(prompt).toHaveValue("登录前编辑的草稿");
  expect(navigations).toBe(0);
});

for (const layout of ["expanded", "collapsed", "mobile"] as const) {
  test(`rejected login toast stays viewport-centered with ${layout} navigation`, async ({
    page,
  }) => {
    await mockImageApi(page);
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
    if (layout === "collapsed")
      await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
    await page.getByRole("button", { name: "登录领积分", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "欢迎使用 Lycobo" });
    await dialog.getByLabel("企业账号", { exact: true }).fill("login-fixture");
    const password = dialog.getByLabel("密码", { exact: true });
    await password.fill("wrong-fixture-password");
    const submit = dialog.getByRole("button", { name: "登录", exact: true });
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
    // A second failed attempt still produces one toast, without stacking or moving the form.
    await password.fill("another-wrong-password");
    await submit.click();
    await expect(page.locator(".toast-region .toast")).toHaveCount(1);
    await expect(dialog.getByText(message, { exact: true })).toHaveCount(0);
  });
}
