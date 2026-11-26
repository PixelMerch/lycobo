import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("top navigation stays in one row and keeps drafts across desktop and mobile", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 1584, height: 993 });
  await page.goto("/commerce/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留这份商品创作草稿");
  await expect(page.locator(".sidebar")).toHaveCount(0);
  const navigation = page.getByRole("navigation", { name: "主导航", exact: true });
  const rows = navigation.locator(".nav-row");
  await expect(rows).toHaveText(["首页"]);
  const workspace = page.locator(".topbar").getByRole("button", { name: "工作区", exact: true });
  await expect(workspace).toHaveCount(0);
  const main = await page.locator(".main-content").boundingBox();
  expect(main?.x).toBe(0);
  await navigation.getByRole("link", { name: "首页", exact: true }).click();
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  await expect(rows).toHaveText(["首页", "电商"]);
  await expect(workspace).toBeVisible();
  const tops = await rows.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
  );
  for (const top of tops) expect(top).toBe(tops[0]);
  const commerce = navigation.getByRole("button", { name: "电商", exact: true });
  await commerce.click();
  const tools = page.getByRole("menu", { name: "电商功能" });
  await expect(tools.getByRole("menuitem")).toHaveText([
    "主图制作",
    "家纺裂变",
    "套图计划",
    "爆款复制",
  ]);
  await tools.getByRole("menuitem", { name: "主图制作", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\?tool=create#commerce-composer$/);
  await page
    .locator("#commerce-composer")
    .getByRole("link", { name: "进入工作区", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  const mobile = page.locator(".mobile-nav");
  await expect(mobile.locator("nav .nav-row")).toHaveText(["首页"]);
  await expect(mobile.getByRole("button", { name: "素材库", exact: true })).toBeVisible();
  await mobile.getByRole("button", { name: "关闭导航", exact: true }).click();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
});

for (const mobile of [false, true]) {
  test(`signed-out navigation opens login for protected entries on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await mockImageApi(page, { signedIn: false });
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1584, height: 993 });
    await page.goto("/zh-CN");
    const navigation = page.locator(".topbar");
    // 未登录时，桌面和手机都从「开始创作」进入需要登录的工作区。
    await expect(navigation.getByRole("link", { name: "工作区", exact: true })).toHaveCount(0);
    await expect(navigation.getByRole("button", { name: "账户设置", exact: true })).toHaveCount(0);
    await navigation.getByRole("link", { name: "开始创作", exact: true }).click();
    const login = page.locator(".login-page");
    await expect(login).toBeVisible();
    expect(new URL(page.url()).searchParams.get("returnTo")).toMatch(/^\/zh-CN\/dashboard(?:\/|$)/);
    await login.getByRole("button", { name: "关闭登录", exact: true }).click();
    await expect(page).toHaveURL(/\/zh-CN\/?$/);
  });
}

for (const path of [
  "/workspace",
  "/commerce/create",
  "/commerce/textile-set",
  "/commerce/smart-variation",
  "/video",
  "/assets",
]) {
  test(`signed-out direct route ${path} requires login without mounting business pages`, async ({
    page,
  }) => {
    await mockImageApi(page, { signedIn: false });
    const requests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/v1\/(image-session|image-assets|image-tasks|image-uploads)/.test(request.url()))
        requests.push(request.url());
    });
    await page.goto(path);
    const login = page.locator(".login-page");
    await expect(login).toBeVisible();
    await expect(page.getByText("素材暂时不可用", { exact: true })).toHaveCount(0);
    await expect(page.getByText("请先登录", { exact: true })).toHaveCount(0);
    await expect(page.locator(".composer-panel, .asset-browser")).toHaveCount(0);
    expect(requests).toEqual([]);
    await login.getByRole("button", { name: "关闭登录", exact: true }).click();
    await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  });
}

for (const action of [
  "upload",
  "keyboard-upload",
  "prompt",
  "settings",
  "shortcut",
  "file-input",
] as const) {
  test(`homepage ${action} requires login before changing drafts or selecting files`, async ({
    page,
  }) => {
    await mockImageApi(page, { signedIn: false });
    let fileChoosers = 0;
    page.on("filechooser", () => fileChoosers++);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "创作灵感" })).toBeVisible();
    await expect(page.locator(".login-page")).toHaveCount(0);
    const upload = page.getByRole("button", { name: "添加参考图", exact: true });
    if (action === "upload") await upload.click();
    if (action === "keyboard-upload") {
      await upload.focus();
      await upload.press("Enter");
    }
    if (action === "prompt") await page.getByRole("textbox", { name: "创作需求" }).click();
    if (action === "settings")
      await page.getByRole("button", { name: "选择创作模型", exact: true }).click();
    if (action === "shortcut")
      await page.getByRole("button", { name: "白底主图", exact: true }).click();
    if (action === "file-input")
      await page.getByLabel("添加参考图片", { exact: true }).setInputFiles({
        name: "product.png",
        mimeType: "image/png",
        buffer: Buffer.from("not-read-before-login"),
      });
    const login = page.locator(".login-page");
    await expect(login).toBeVisible();
    expect(fileChoosers).toBe(0);
    await login.getByRole("button", { name: "关闭登录", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("");
    await expect(page.locator(".reference-image-card")).toHaveCount(0);
    await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  });
}

test("homepage inspirations remain browsable while applying a prompt requires login", async ({
  page,
}) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/");
  await page
    .getByRole("button", { name: /^查看灵感：/ })
    .first()
    .click();
  const detail = page.getByRole("dialog", { name: /^灵感详情：/ });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "做同款", exact: true }).click();
  const login = page.locator(".login-page");
  await expect(login).toBeVisible();
  await login.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(page).toHaveURL(/\/(?:zh-CN|en)\/?$/);
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("");
});
