import { expect, test } from "@playwright/test";
import { mockImageApi, modelNames } from "./image-api-fixture";

for (const path of ["/", "/create"]) {
  test(`all model resolution options follow the API at ${path}`, async ({ page }) => {
    await mockImageApi(page);
    await page.goto(path);
    const home = path === "/";
    if (home) await page.getByRole("button", { name: "选择创作模型", exact: true }).click();
    for (const model of modelNames) {
      if (home)
        await page
          .locator(".home-model-option")
          .filter({ has: page.getByText(model, { exact: true }) })
          .click();
      else {
        await page.getByRole("button", { name: /创作模型/ }).click();
        await page.getByRole("option", { name: model, exact: true }).click();
      }
      for (const resolution of ["1K", "2K", "4K"]) {
        const option = page.getByRole("radio", { name: resolution, exact: true });
        await expect(option).toBeEnabled();
        await option.click();
        await expect(option).toHaveAttribute("aria-checked", "true");
      }
    }
    if (home)
      await page
        .locator(".home-model-option")
        .filter({ has: page.getByText("gpt-image-2", { exact: true }) })
        .click();
    else {
      await page.getByRole("button", { name: /创作模型/ }).click();
      await page.getByRole("option", { name: "gpt-image-2", exact: true }).click();
    }
    await expect(page.getByRole("radio", { name: "4K", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
}
