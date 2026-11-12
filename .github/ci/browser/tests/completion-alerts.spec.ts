import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function setup(page: Page, identity?: { userId: string; organizationId: string }) {
  await mockImageApi(page);
  if (identity) {
    await page.route("**/api/v1/image-session", (route) =>
      route.fulfill({ json: apiFixture(identity) }),
    );
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({
        json: apiFixture({ ...identity, account: "shared-fixture", role: "member" }),
      }),
    );
  }
  await page.goto("/commerce/create");
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
  const scope = await page.evaluate(async () => {
    const response = await fetch("/api/v1/image-session", { method: "POST" });
    const body = await response.json();
    return { userId: String(body.data.userId), organizationId: String(body.data.organizationId) };
  });
  const job = {
    id: crypto.randomUUID(),
    public_id: "W12345678",
    user_id: scope.userId,
    organization_id: scope.organizationId,
    model: "gpt-image-2",
    prompt: "完成提醒测试任务",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "running",
    created_at: new Date().toISOString(),
    completed_at: null,
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "running",
        output_asset_id: null,
        error_code: null,
        width: null,
        height: null,
        worker_id: null,
      },
    ],
  };
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route(`**/api/v1/image-tasks/${job.id}`, (route) =>
    route.fulfill({
      json: apiFixture({
        ...job,
        status: "succeeded",
        completed_at: new Date().toISOString(),
        items: job.items.map((item) => ({
          ...item,
          status: "succeeded",
          output_asset_id: crypto.randomUUID(),
          width: 1024,
          height: 1024,
        })),
      }),
    }),
  );
  return { job, scope };
}
async function emit(page: Page, id: string, cursor: string) {
  await page.evaluate(
    ({ id, cursor }) =>
      window.dispatchEvent(
        new CustomEvent("fixture:realtime", {
          detail: {
            type: "image.updated",
            id: cursor,
            data: { id: cursor, kind: "task", resourceId: id },
          },
        }),
      ),
    { id, cursor },
  );
}
async function hidden(page: Page, value: boolean) {
  // 显式模拟页面可见性，避免无头浏览器窗口焦点差异导致不稳定。
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (value ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}

test("background title counts once, returns to a result action and preserves the draft", async ({
  page,
}) => {
  const { job } = await setup(page);
  const prompt = page.getByRole("textbox", { name: "提示词", exact: true });
  await prompt.fill("保留这份未提交草稿");
  await page
    .getByRole("navigation", { name: "主导航", exact: true })
    .getByRole("link", { name: "首页", exact: true })
    .click();
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  const title = await page.title();
  await hidden(page, true);
  await emit(page, job.id, "1");
  await expect(page).toHaveTitle("（1）生成完成 · Lycobo");
  await emit(page, job.id, "2");
  await expect(page).toHaveTitle("（1）生成完成 · Lycobo");
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  await hidden(page, false);
  await expect(page).toHaveTitle(title);
  await expect(page.getByRole("button", { name: "查看结果", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/lycobo-completion-toast.png" });
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  await page.getByRole("button", { name: "查看结果", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/commerce/create\\?task=${job.id}`));
  await expect(prompt).toContainText("保留这份未提交草稿");
  await expect(page.locator(`#job-${job.id}`)).toBeVisible();
  await emit(page, job.id, "3");
  await expect(page.getByRole("button", { name: "查看结果", exact: true })).toHaveCount(0);
});

test("visible other page offers a result without navigating and desktop permission is manual", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FixtureNotification {
      static permission = "default";
      static async requestPermission() {
        document.documentElement.dataset.permissionRequests = String(
          Number(document.documentElement.dataset.permissionRequests ?? 0) + 1,
        );
        FixtureNotification.permission = "granted";
        return "granted";
      }
      onclick = null;
      constructor() {
        document.documentElement.dataset.desktopNotices = String(
          Number(document.documentElement.dataset.desktopNotices ?? 0) + 1,
        );
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", { value: FixtureNotification });
  });
  const { job } = await setup(page);
  await page
    .getByRole("navigation", { name: "主导航", exact: true })
    .getByRole("link", { name: "首页", exact: true })
    .click();
  await expect(page.locator("html")).not.toHaveAttribute("data-permission-requests");
  await emit(page, job.id, "1");
  await expect(page.getByRole("button", { name: "查看结果", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  const account = page.getByRole("button", { name: /^账户菜单：/ });
  await account.click();
  const desktopNotifications = page.getByRole("switch", { name: "桌面通知", exact: true });
  await expect(desktopNotifications).not.toBeChecked();
  await desktopNotifications.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests", "1");
  await expect(desktopNotifications).toBeChecked();
  await desktopNotifications.press("Space");
  await expect(desktopNotifications).not.toBeChecked();
  await desktopNotifications.press("Space");
  await expect(desktopNotifications).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-permission-requests", "1");
  await page.keyboard.press("Enter");
  await expect(desktopNotifications).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-desktop-notices");
  await hidden(page, true);
  const second = crypto.randomUUID();
  await page.route(`**/api/v1/image-tasks/${second}`, (route) =>
    route.fulfill({
      json: apiFixture({
        ...job,
        id: second,
        status: "succeeded",
        completed_at: new Date().toISOString(),
        items: job.items.map((item) => ({
          ...item,
          status: "succeeded",
          output_asset_id: crypto.randomUUID(),
        })),
      }),
    }),
  );
  await emit(page, second, "2");
  await expect(page.locator("html")).toHaveAttribute("data-desktop-notices", "1");
  await emit(page, second, "3");
  await expect(page.locator("html")).toHaveAttribute("data-desktop-notices", "1");
});

test("two tabs share one completion receipt", async ({ page, context }) => {
  const first = await setup(page);
  const second = await context.newPage();
  await setup(second, first.scope);
  const result = {
    ...first.job,
    status: "succeeded",
    completed_at: new Date().toISOString(),
    items: first.job.items.map((item) => ({
      ...item,
      status: "succeeded",
      output_asset_id: crypto.randomUUID(),
    })),
  };
  let reads = 0;
  for (const tab of [page, second]) {
    await tab.route(`**/api/v1/image-tasks/${first.job.id}`, (route) => {
      reads++;
      return route.fulfill({ json: apiFixture(result) });
    });
    await tab
      .getByRole("navigation", { name: "主导航", exact: true })
      .getByRole("link", { name: "首页", exact: true })
      .click();
    await hidden(tab, false);
    await expect(tab.locator("html")).toHaveAttribute("data-ws-active", "1");
  }
  await Promise.all([emit(page, first.job.id, "1"), emit(second, first.job.id, "1")]);
  await expect.poll(() => reads).toBe(2);
  await expect
    .poll(
      async () =>
        (await page.getByRole("button", { name: "查看结果", exact: true }).count()) +
        (await second.getByRole("button", { name: "查看结果", exact: true }).count()),
    )
    .toBe(1);
});

test("mobile result action reveals history and keeps the form draft", async ({ page }) => {
  const { job } = await setup(page);
  await page.getByRole("textbox", { name: "提示词", exact: true }).fill("手机未提交草稿");
  await page
    .getByRole("navigation", { name: "主导航", exact: true })
    .getByRole("link", { name: "首页", exact: true })
    .click();
  await emit(page, job.id, "1");
  await expect(page.getByRole("button", { name: "查看结果", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 393, height: 852 });
  await page.getByRole("button", { name: "查看结果", exact: true }).click();
  await expect(page.locator("[data-mobile-panel]")).toHaveAttribute("data-mobile-panel", "history");
  await expect(page.locator(`#job-${job.id}`)).toBeVisible();
  await page.getByRole("radio", { name: "创作", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "提示词", exact: true })).toContainText(
    "手机未提交草稿",
  );
});
