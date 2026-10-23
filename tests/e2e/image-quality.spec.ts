import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const [label, quality] of [
  ["低", "low"],
  ["标准", "medium"],
  ["高", "high"],
] as const) {
  test(`submits ${label} image quality`, async ({ page }) => {
    await mockImageApi(page);
    await page.route("**/api/v1/image-tasks", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const body: unknown = route.request().postDataJSON();
      expect(body).toMatchObject({ quality, prompt: "质量参数验收" });
      await route.fulfill({ status: 202, json: { id: crypto.randomUUID(), replayed: false } });
    });
    await page.goto("/create");
    await page.getByLabel("提示词", { exact: true }).fill("质量参数验收");
    await page.getByRole("button", { name: "更多", exact: true }).click();
    await page.getByRole("radio", { name: label, exact: true }).click();
    const submitted = page.waitForRequest(
      (request) => request.url().endsWith("/api/v1/image-tasks") && request.method() === "POST",
    );
    await page.getByRole("button", { name: "立即生成", exact: true }).click();
    expect((await submitted).postDataJSON()).toMatchObject({ quality });
  });
}
