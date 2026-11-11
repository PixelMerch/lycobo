import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("main image defaults to 2.6 and submits the selected model once", async ({ page }) => {
  await mockImageApi(page);
  const submissions: unknown[] = [];
  await page.route("**/api/v1/image-tasks", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: apiFixture({ data: [] }) });
    submissions.push(route.request().postDataJSON());
    return route.fulfill({
      status: 202,
      json: apiFixture({ id: crypto.randomUUID(), replayed: false }),
    });
  });
  await page.goto("/commerce/create");
  const select = page.locator(".model-select");
  await expect(select).toContainText("Image 2.6");
  await select.click();
  await expect(page.getByRole("option")).toHaveText(["Image 2.6", "Image 2.5", "Image 2"]);
  await page.getByRole("option", { name: "Image 2.6", exact: true }).click();
  const submit = page.getByRole("button", { name: "立即生成", exact: true });
  await expect(submit).toBeDisabled();
  await expect(submit.locator(".generate-credit-cost")).toHaveCount(0);
  await page.getByRole("textbox", { name: "提示词", exact: true }).fill("仅提交本地模拟任务");
  await expect(submit.locator(".generate-credit-cost")).toHaveText("2");
  await submit.click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ model: "gpt-image-2.6", count: 1 });
  await page.goto("/commerce/create/gpt-image-2.5?task=result-link");
  await expect(page).toHaveURL(/\/commerce\/create\?task=result-link$/);
  await expect(select).toContainText("Image 2.5");
});
