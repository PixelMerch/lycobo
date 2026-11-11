import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);
test("assets use signed resource URLs without business API image downloads or polling", async ({
  page,
}) => {
  await mockImageApi(page);
  const id = crypto.randomUUID();
  const url = `https://resources.example.test/${id}.png?expires=9999999999&sig=fixture`;
  let apiImages = 0,
    metadata = 0,
    resourceReads = 0;
  await page.route("**/api/v1/image-assets?*", (route) => {
    metadata++;
    const refreshedUrl = metadata === 1 ? url : `${url}&refresh=${metadata}`;
    return route.fulfill({
      json: apiFixture({
        data: [
          {
            id,
            kind: "output",
            width: 1,
            height: 1,
            bytes: png.length,
            created_at: new Date().toISOString(),
            model: "gpt-image-2",
            prompt: "资源图片",
            task_public_id: null,
            delivery: {
              url: refreshedUrl,
              thumbnail_url: `${refreshedUrl}&variant=thumbnail`,
              download_url: `${refreshedUrl}&variant=download`,
              expires_at: 9999999999,
            },
          },
        ],
      }),
    });
  });
  await page.route("**/api/v1/image-assets/*/content*", (route) => {
    apiImages++;
    return route.fulfill({ contentType: "image/png", body: png });
  });
  await page.route("https://resources.example.test/**", (route) => {
    resourceReads++;
    expect(route.request().headers().referer).toBe("http://127.0.0.1:5173/");
    return route.fulfill({
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:5173" },
      body: png,
    });
  });
  await page.goto("/assets");
  const image = page.locator(".asset-tile img");
  await expect(image).toHaveAttribute("src", `${url}&variant=thumbnail`);
  await expect
    .poll(() => image.evaluate((node) => node instanceof HTMLImageElement && node.naturalWidth))
    .toBe(1);
  expect(resourceReads).toBe(1);
  expect(apiImages).toBe(0);
  expect(metadata).toBe(1);
  await page.clock.install();
  await page.clock.fastForward(65000);
  expect({ resourceReads, apiImages, metadata }).toEqual({
    resourceReads: 1,
    apiImages: 0,
    metadata: 1,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  // Returning to an idle tab must not wake shared PG (global query policy).
  await page.clock.runFor(200);
  expect(metadata).toBe(1);
  await expect(image).toHaveAttribute("src", `${url}&variant=thumbnail`);
  expect(resourceReads).toBe(1);
  await page.reload();
  // Metadata is re-authorized, but a changed signature does not replace a valid preview.
  await expect(image).toHaveAttribute("src", `${url}&variant=thumbnail`);
  expect(metadata).toBe(2);
});
