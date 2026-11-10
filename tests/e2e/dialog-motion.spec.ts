import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function fixture(page: Page) {
  await mockImageApi(page);
  const imageId = crypto.randomUUID();
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "家纺场景",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "succeeded",
    created_at: "2026-10-20T01:00:00.000Z",
    completed_at: "2026-10-20T01:01:00.000Z",
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "succeeded",
        output_asset_id: imageId,
        error_code: null,
        width: 1024,
        height: 1024,
        worker_id: "fixture-worker",
      },
    ],
  };
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id: imageId,
            kind: "output",
            width: 1024,
            height: 1024,
            bytes: 100,
            model: job.model,
            prompt: job.prompt,
            created_at: job.created_at,
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#555"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
}

/** Record real rendered exit frames, including the time before the modal unmounts. */
function exitFrames(page: Page, selector: string) {
  return page.evaluate(async (target) => {
    const surface = document.querySelector<HTMLElement>(target);
    if (!surface) throw new Error("Missing dialog surface");
    const samples: Array<{ scale: number; opacity: number; x: number; y: number }> = [];
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const sample = () => {
        if (!surface.isConnected || performance.now() - started > 3000) return resolve();
        if (surface.dataset.dialogPhase === "closed") {
          const style = getComputedStyle(surface);
          const box = surface.getBoundingClientRect();
          samples.push({
            scale: new DOMMatrixReadOnly(style.transform).a,
            opacity: Number(style.opacity),
            x: box.x + box.width / 2 - innerWidth / 2,
            y: box.y + box.height / 2 - innerHeight / 2,
          });
        }
        requestAnimationFrame(sample);
      };
      sample();
    });
    return samples;
  }, selector);
}

for (const activation of ["pointer", "virtual"] as const) {
  test(`preview and history library shrink to the viewport centre before restoring focus (${activation})`, async ({
    page,
  }) => {
    await fixture(page);
    const previewEntry = page.getByRole("button", { name: "预览图片 1", exact: true });
    if (activation === "pointer") await previewEntry.click();
    else await previewEntry.evaluate((button: HTMLButtonElement) => button.click());
    const preview = page.locator(".image-preview");
    await expect(preview).toHaveCSS("transform", "none");
    const previewFrames = exitFrames(page, ".image-preview");
    await page.keyboard.press("Escape");
    const frames = await previewFrames;
    expect(frames.some((frame) => frame.scale > 0 && frame.scale < 0.95 && frame.opacity < 1)).toBe(
      true,
    );
    expect(frames.every((frame) => Math.abs(frame.x) < 1 && Math.abs(frame.y) < 1)).toBe(true);
    await expect(page.getByRole("dialog", { name: "图片预览", exact: true })).toHaveCount(0);
    await expect(previewEntry).toBeFocused();

    const libraryEntry = page.getByRole("button", { name: "打开素材库", exact: true });
    await libraryEntry.click();
    await expect(page.locator(".library-shell")).toHaveCSS("transform", "none");
    const libraryFrames = exitFrames(page, ".library-shell");
    await page.getByRole("button", { name: "关闭素材库", exact: true }).click();
    const library = await libraryFrames;
    expect(
      library.some((frame) => frame.scale > 0 && frame.scale < 0.95 && frame.opacity < 1),
    ).toBe(true);
    expect(library.every((frame) => Math.abs(frame.x) < 1 && Math.abs(frame.y) < 1)).toBe(true);
    await expect(page.getByRole("dialog", { name: "素材库", exact: true })).toHaveCount(0);
    await expect(libraryEntry).toBeFocused();
  });
}

test("reduced motion opens both surfaces without scaling and nested preview returns to library", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture(page);
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  await expect(page.locator(".library-shell")).toHaveCSS("transform", "none");
  await page.getByRole("button", { name: "查看图片：家纺场景", exact: true }).click();
  await expect(page.locator(".image-preview")).toHaveCSS("transform", "none");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "图片预览", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "素材库", exact: true })).toBeVisible();
  // 焦点回到打开预览的那张卡片后，再按 Esc 才是关闭素材库。
  await expect(page.getByRole("button", { name: "查看图片：家纺场景", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "打开素材库", exact: true })).toBeFocused();
});
