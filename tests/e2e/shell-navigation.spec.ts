import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test("workspace navigation remains compact and aligned across desktop and mobile", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.setViewportSize({ width: 1584, height: 993 });
  await page.goto("/commerce/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留这份商品创作草稿");
  const rows = page.locator(".sidebar nav .nav-row");
  await expect(rows).toHaveText(["首页", "工作区", "素材库"]);
  const positions = await rows.evaluateAll((nodes) =>
    nodes.map((node) => ({
      icon: node.querySelector(".ui-icon")?.getBoundingClientRect().x,
      text: node.querySelector(".nav-label")?.getBoundingClientRect().x,
    })),
  );
  for (const position of positions) expect(position).toEqual(positions[0]);
  await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
  await expect
    .poll(async () => Math.round((await page.locator(".sidebar").boundingBox())?.width ?? 0))
    .toBe(64);
  const workspace = page.getByRole("link", { name: "工作区", exact: true });
  await workspace.hover();
  await expect(page.getByRole("tooltip", { name: "工作区", exact: true })).toBeVisible();
  await workspace.click();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  const mobile = page.locator(".mobile-nav");
  await expect(mobile.locator("nav .nav-row")).toHaveText(["首页", "工作区", "素材库"]);
  await mobile.getByRole("button", { name: "关闭导航", exact: true }).click();
  await expect(prompt).toHaveValue("保留这份商品创作草稿");
});

for (const mobile of [false, true]) {
  test(`signed-out navigation opens login for protected entries on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await mockImageApi(page, { signedIn: false });
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1584, height: 993 });
    for (const entry of ["工作区", "素材库"]) {
      await page.goto("/");
      if (mobile) await page.getByRole("button", { name: "打开导航", exact: true }).click();
      const navigation = page.locator(mobile ? ".mobile-nav" : ".sidebar");
      await expect(navigation.getByRole("button", { name: "账户设置", exact: true })).toHaveCount(
        0,
      );
      await expect(navigation.getByRole("button", { name: "帮助中心", exact: true })).toHaveCount(
        0,
      );
      await navigation.getByRole("link", { name: entry, exact: true }).click();
      const login = page.getByRole("dialog", { name: "欢迎使用 Lycobo", exact: true });
      await expect(login).toBeVisible();
      await login.getByRole("button", { name: "关闭登录", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
    }
  });
}

for (const path of [
  "/workspace",
  "/commerce/create",
  "/commerce/textile-set",
  "/commerce/smart-variation",
  "/video",
  "/assets",
  "/membership",
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
    const login = page.getByRole("dialog", { name: "欢迎使用 Lycobo", exact: true });
    await expect(login).toBeVisible();
    await expect(page.getByText("素材暂时不可用", { exact: true })).toHaveCount(0);
    await expect(page.getByText("请先登录", { exact: true })).toHaveCount(0);
    await expect(page.locator(".composer-panel, .asset-browser")).toHaveCount(0);
    expect(requests).toEqual([]);
    await login.getByRole("button", { name: "关闭登录", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
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
    await expect(page.getByRole("dialog", { name: "欢迎使用 Lycobo" })).toHaveCount(0);
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
      await page.getByRole("button", { name: "商品主图", exact: true }).click();
    if (action === "file-input")
      await page.getByLabel("添加参考图片", { exact: true }).setInputFiles({
        name: "product.png",
        mimeType: "image/png",
        buffer: Buffer.from("not-read-before-login"),
      });
    const login = page.getByRole("dialog", { name: "欢迎使用 Lycobo", exact: true });
    await expect(login).toBeVisible();
    expect(fileChoosers).toBe(0);
    await login.getByRole("button", { name: "关闭登录", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("");
    await expect(page.locator(".reference-image-card")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
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
  const login = page.getByRole("dialog", { name: "欢迎使用 Lycobo", exact: true });
  await expect(login).toBeVisible();
  await login.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "关闭灵感详情", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "创作需求" })).toHaveValue("");
});
