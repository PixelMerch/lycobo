import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("expired access is renewed once and restores the mounted workspace without a login", async ({
  page,
}) => {
  await mockImageApi(page);
  const user = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    account: "renew-fixture",
    role: "member",
  };
  let accessValid = false;
  let refreshValid = true;
  let refreshes = 0;
  await page.route("**/api/v1/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/refresh")) {
      refreshes++;
      if (refreshValid) {
        accessValid = true;
        return route.fulfill({
          json: apiFixture({}),
          headers: { "X-Auth-Expires-At": String(Math.floor(Date.now() / 1000) + 86400) },
        });
      }
    }
    if (path.endsWith("/logout")) {
      accessValid = false;
      refreshValid = false;
      return route.fulfill({ json: apiFixture({}) });
    }
    return route.fulfill({
      status: accessValid ? 200 : 401,
      json: apiFixture(accessValid ? user : {}, accessValid ? 200 : 401),
      headers: accessValid
        ? { "X-Auth-Expires-At": String(Math.floor(Date.now() / 1000) + 86400) }
        : {},
    });
  });
  await page.route("**/api/v1/image-session", (route) =>
    route.fulfill({
      status: accessValid ? 200 : 401,
      json: accessValid
        ? apiFixture(user)
        : {
            request_id: crypto.randomUUID(),
            code: 40100,
            message: "请先登录",
            data: {},
            error: { code: "UNAUTHORIZED" },
          },
    }),
  );
  await page.goto("/commerce/create");
  await expect(page.locator(".account-trigger")).toHaveAccessibleName(`账户菜单：${user.account}`);
  await expect(page.getByText("登录后查看生成记录", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeVisible();
  expect(refreshes).toBe(1);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => /token|jwt|password/i.test(key)),
    ),
  ).toBe(false);
  await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("自动续期保留的草稿");
  await page.locator(".account-trigger").click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.locator(".login-page")).toBeVisible();
  await page.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "创作需求", exact: true })).toHaveValue(
    "自动续期保留的草稿",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toBeVisible();
});
