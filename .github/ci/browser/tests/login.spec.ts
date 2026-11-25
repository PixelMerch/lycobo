import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi, mockPasswordTurnstile } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
  await mockPasswordTurnstile(page);
});

test("a backdrop click closes login while card clicks and drags keep it open", async ({ page }) => {
  await page.goto("/zh-CN/login");
  const login = page.locator(".login-page");
  const card = login.locator(".login-shell");
  await card.click({ position: { x: 4, y: 4 } });
  await expect(login).toBeVisible();
  await page.mouse.move(8, 8);
  await page.mouse.down();
  await page.mouse.move(80, 8);
  await page.mouse.up();
  await expect(login).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(login).toHaveCount(0);
  await expect(page).toHaveURL(/\/zh-CN\/?$/);
});

test("login offers unavailable providers without requests and keeps enterprise fields on a separate face", async ({
  page,
}) => {
  const authRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      request.url().includes("/auth/") &&
      !request.url().endsWith("/auth/refresh")
    )
      authRequests.push(request.url());
  });
  await page.goto("/");
  const entry = page.getByRole("button", { name: "登录领积分", exact: true });
  await entry.click();
  const dialog = page.locator(".login-page");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  for (const name of ["使用 Google 登录", "使用 Apple 登录", "发送验证码"])
    await expect(dialog.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect(dialog.getByRole("textbox", { name: "邮箱", exact: true })).toBeDisabled();
  await expect(dialog.getByText("Google、Apple 和邮箱登录暂未开放", { exact: true })).toBeVisible();
  const enterprise = dialog.getByRole("button", { name: "企业账号登录", exact: true });
  await expect(enterprise).toBeVisible();
  await expect(dialog.getByLabel("企业账号", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("密码", { exact: true })).toHaveCount(0);
  await expect(page.locator(".sidebar, .topbar")).toHaveCount(0);
  await expect(dialog.locator(".login-panel")).toHaveCSS("backdrop-filter", "blur(40px)");

  await enterprise.hover();
  await page.screenshot({
    path: "/tmp/lycobo-login-collapsed-desktop.png",
    animations: "disabled",
  });
  expect(authRequests).toEqual([]);
  await page.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeVisible();
});

test("enterprise flip hides the other methods, keeps card height and clears passwords on return", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const panel = page.locator(".login-panel");
  const height = (await panel.boundingBox())?.height;
  const enterprise = page.getByRole("button", { name: "企业账号登录", exact: true });
  await enterprise.focus();
  await enterprise.press("Enter");
  const account = page.getByLabel("企业账号", { exact: true });
  const password = page.getByLabel("密码", { exact: true });
  await expect(account).toBeFocused();
  await expect(account).toHaveCSS("caret-color", "rgb(168, 255, 0)");
  await expect(panel.locator(".login-submit")).toHaveCSS(
    "background-image",
    /linear-gradient\(110deg, rgb\(168, 255, 0\), rgb\(89, 230, 162\)\)/,
  );
  await expect(page.getByRole("button", { name: "使用 Google 登录", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("邮箱", { exact: true })).toHaveCount(0);
  expect((await panel.boundingBox())?.height).toBe(height);
  await account.fill("merchant-fixture");
  await password.fill("fixture-password");
  await page.getByRole("button", { name: "显示密码", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  const back = page.getByRole("button", { name: "返回其他登录方式", exact: true });
  await back.focus();
  await back.press("Space");
  await expect(enterprise).toBeFocused();
  await expect(password).toHaveCount(0);
  expect((await panel.boundingBox())?.height).toBe(height);
  await enterprise.press("Enter");
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  await page.screenshot({
    path: "/tmp/lycobo-login-enterprise-desktop.png",
    animations: "disabled",
  });
});

test("enterprise validates required fields and reports failure without storing a password", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/v1/auth/enterprise/login", (route) => {
    submissions++;
    return route.fulfill({
      status: 401,
      json: {
        request_id: crypto.randomUUID(),
        code: 40101,
        message: "账号或密码错误",
        data: {},
        error: { code: "INVALID_CREDENTIALS" },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.locator(".login-page");
  await dialog.getByRole("button", { name: "企业账号登录", exact: true }).click();
  const submit = dialog.getByRole("button", { name: "登录企业账号", exact: true });
  await submit.click();
  await expect(dialog.getByText("请输入企业账号", { exact: true })).toBeVisible();
  await expect(dialog.getByText("请输入密码", { exact: true })).toBeVisible();
  expect(submissions).toBe(0);
  await dialog.getByLabel("企业账号", { exact: true }).fill("merchant-fixture");
  const password = dialog.getByLabel("密码", { exact: true });
  await password.fill("wrong-fixture-password");
  await submit.click();
  await expect(page.locator(".toast-region")).toContainText("账号或密码错误");
  await expect(password).toHaveValue("");
  await expect(password).toBeFocused();
  await expect(dialog.getByText("账号或密码错误", { exact: true })).toHaveCount(0);
  expect(submissions).toBe(1);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => /token|jwt|password/i.test(key)),
    ),
  ).toBe(false);
});

test("pending enterprise login blocks repeat submissions and changing methods", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const responseReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  await page.route("**/api/v1/auth/enterprise/login", async (route) => {
    submissions++;
    await responseReady;
    await route.fulfill({ status: 503, json: apiFixture({}, 503) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.locator(".login-page");
  const enterprise = dialog.getByRole("button", { name: "企业账号登录", exact: true });
  await enterprise.click();
  await dialog.getByLabel("企业账号", { exact: true }).fill("merchant-fixture");
  await dialog.getByLabel("密码", { exact: true }).fill("fixture-password");
  await dialog.getByRole("button", { name: "登录企业账号", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "返回其他登录方式", exact: true }),
  ).toBeDisabled();
  // 提交中文字不变，箭头换成加载图标；不用“登录中…”这类省略号文案。
  await expect(dialog.getByRole("button", { name: /登录企业账号/ })).toBeDisabled();
  await expect(dialog.getByRole("status", { name: "正在登录" })).toBeVisible();
  await expect(dialog.getByText(/登录中/)).toHaveCount(0);
  await page.keyboard.press("Enter");
  expect(submissions).toBe(1);
  release();
  await expect(dialog.getByRole("button", { name: "返回其他登录方式", exact: true })).toBeEnabled();
  await expect(dialog.getByLabel("密码", { exact: true })).toHaveValue("");
});

test("enterprise login sends a challenge token and keeps the lock message in the form", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/enterprise/login", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      captchaToken: "password-fixture-token",
    });
    return route.fulfill({
      status: 429,
      headers: { "Retry-After": "3600" },
      json: {
        request_id: crypto.randomUUID(),
        code: 20006,
        message: "密码错误次数过多，账号已锁定 1 小时。请在解锁后重试。",
        data: {},
        error: { code: "ACCOUNT_LOCKED" },
      },
    });
  });
  await page.goto("/zh-CN/login");
  await page.getByRole("button", { name: "企业账号登录", exact: true }).click();
  await page.getByLabel("企业账号", { exact: true }).fill("locked-fixture");
  await page.getByLabel("密码", { exact: true }).fill("password-fixture");
  await page.getByRole("button", { name: "登录企业账号", exact: true }).click();
  await expect(page.locator(".login-lock-notice")).toContainText("账号已锁定 1 小时");
});

test("sending an email code shows a spinner, sends once and confirms with a toast", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const responseReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  let sends = 0;
  // 人机验证脚本换成立即给令牌的替身，不访问 Cloudflare。
  await page.route("https://challenges.cloudflare.com/turnstile/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback('fixture-token'));return 'fixture'},remove:()=>{}};",
    }),
  );
  await page.route("**/api/v1/auth/oauth/providers", (route) =>
    route.fulfill({
      json: apiFixture({ providers: [], emailTurnstileSiteKey: "fixture-site-key" }),
    }),
  );
  await page.route("**/api/v1/auth/email/send", async (route) => {
    sends++;
    await responseReady;
    await route.fulfill({ json: apiFixture({}) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.locator(".login-page");
  await dialog.getByRole("textbox", { name: "邮箱", exact: true }).fill("fixture@example.com");
  await dialog.getByRole("button", { name: "发送验证码", exact: true }).click();
  // 发送中文字不变、前面转圈，按钮保持原亮度；再按回车也不会再发一封。
  await expect(dialog.getByRole("status", { name: "正在发送验证码" })).toBeVisible();
  const sending = dialog.getByRole("button", { name: /发送验证码/ });
  await expect(sending).toHaveAttribute("data-pending", "true");
  await expect(sending).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  expect(sends).toBe(1);
  release();
  await expect(page.getByText("验证码已发送，请查收邮箱", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("验证码已发送至 fixture@example.com", { exact: true }),
  ).toBeVisible();
  expect(sends).toBe(1);
});

test("social sign-in spins on the pressed button and confirms success on return", async ({
  page,
}) => {
  let fail: () => void = () => undefined;
  const failed = new Promise<void>((resolve) => {
    fail = resolve;
  });
  await page.route("**/api/v1/auth/oauth/providers", (route) =>
    route.fulfill({ json: apiFixture({ providers: ["google", "apple"] }) }),
  );
  await page.route("**/api/v1/auth/oauth/start", async (route) => {
    await failed;
    await route.fulfill({ status: 503, json: apiFixture({}, 503) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  const dialog = page.locator(".login-page");
  await dialog.getByRole("button", { name: "使用 Google 登录", exact: true }).click();
  // 被点的按钮转圈直到跳走，另一个暂时停用。
  await expect(dialog.getByRole("status", { name: "正在登录" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /使用 Google 登录/ })).toHaveAttribute(
    "data-pending",
    "true",
  );
  await expect(dialog.getByRole("button", { name: "使用 Apple 登录", exact: true })).toBeDisabled();
  fail();
  await expect(dialog.getByText("第三方登录未完成，请重试。", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("status", { name: "正在登录" })).toHaveCount(0);

  // 服务端完成第三方登录后带 oauth=success 回到登录页：提示“登录成功”再回到原页面。
  await mockImageApi(page);
  await page.goto("/zh-CN/login?returnTo=%2Fzh-CN&oauth=success");
  await expect(page.getByText("登录成功", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/zh-CN\/?$/);
});

test("reduced motion switches faces without a 3D transform", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByRole("button", { name: "企业账号登录", exact: true }).click();
  await expect(page.getByLabel("企业账号", { exact: true })).toBeFocused();
  await expect(page.locator(".login-face")).toHaveCSS("transform", "none");
  await page.getByRole("button", { name: "返回其他登录方式", exact: true }).click();
  await expect(page.getByRole("button", { name: "企业账号登录", exact: true })).toBeFocused();
  await expect(page.locator(".login-face")).toHaveCSS("transform", "none");
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`mobile ${viewport.width} login centers each face and keeps actions reachable`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/commerce/create");
    await expect(page.locator(".composer-panel")).toHaveCount(0);
    const dialog = page.locator(".login-page");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "企业账号登录", exact: true }).click();
    await expect(dialog.getByLabel("企业账号", { exact: true })).toBeFocused();
    const password = dialog.getByLabel("密码", { exact: true });
    await password.fill("fixture-password");
    await expect(password).toHaveCSS("font-size", "16px");
    const submit = dialog.getByRole("button", { name: "登录企业账号", exact: true });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport();
    const close = dialog.getByRole("button", { name: "关闭登录", exact: true });
    await expect(close).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/lycobo-login-expanded-${viewport.width}.png`,
      animations: "disabled",
    });
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  });
}

test("enterprise login retains the existing request, session refresh and logout behavior", async ({
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
  const dialog = page.locator(".login-page");
  await dialog.getByRole("button", { name: "企业账号登录", exact: true }).click();
  await dialog.getByLabel("企业账号", { exact: true }).fill(user.account);
  await dialog.getByLabel("密码", { exact: true }).fill("fixture-password");
  await dialog.getByRole("button", { name: "登录企业账号", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // 登录成功用顶部 Toast 告诉用户。
  await expect(page.getByText("登录成功", { exact: true })).toBeVisible();
  await expect(page.locator(".account-trigger")).toHaveAccessibleName("账户菜单：merchant-fixture");
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => /token|jwt|password/i.test(key)),
    ),
  ).toBe(false);
  await page.reload();
  await page.locator(".account-trigger").click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toBeVisible();
  // 退出成功同样用顶部 Toast 告诉用户。
  await expect(page.getByText("已退出登录", { exact: true })).toBeVisible();
});

test("asset authorization failure requests reauthentication even with a cached identity", async ({
  page,
}) => {
  const user = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    account: "stale-fixture",
    role: "member",
  };
  await page.route("**/api/v1/auth/session", (route) => route.fulfill({ json: apiFixture(user) }));
  await page.route("**/api/v1/image-session", (route) =>
    route.fulfill({ status: 401, json: apiFixture({}, 401) }),
  );
  await page.goto("/assets");
  await expect(page).toHaveURL(/\/zh-CN\/login\?returnTo=%2Fzh-CN%2Fdashboard%2Fassets&reauth=1$/);
  await page.getByRole("button", { name: "企业账号登录", exact: true }).click();
  await expect(page.getByLabel("企业账号", { exact: true })).toBeFocused();
  await expect(page.locator(".asset-browser")).toHaveCount(0);
});

test("login return target survives refresh and rejects external destinations", async ({ page }) => {
  await page.goto("/commerce/create?task=fixture#result");
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/zh-CN/dashboard/commerce/create?task=fixture#result",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "企业账号登录", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/zh-CN/dashboard/commerce/create?task=fixture#result",
  );
  await page.goto("/login?returnTo=https%3A%2F%2Fexample.com%2F");
  const homeUrl = new URL("/zh-CN", page.url()).href;
  await page.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(page).toHaveURL(homeUrl);
});
