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
  await dialog.getByRole("button", { name: "企业账号登录", exact: true }).click();
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
