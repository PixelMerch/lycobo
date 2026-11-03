import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

for (const width of [390, 1440]) {
  test(`video creation keeps its draft and product image while generation stays closed at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const videoReads: string[] = [];
    const submissions: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.searchParams.get("tool") === "video") videoReads.push(url.pathname);
      if (request.method() === "POST" && url.pathname.includes("image-tasks"))
        submissions.push(url.pathname);
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/textile-set");
    await page
      .getByLabel("主图文件", { exact: true })
      .setInputFiles({ name: "main.png", mimeType: "image/png", buffer: png });
    const tools = page.getByRole("navigation", { name: "电商创作工具" });
    await tools.getByRole("button", { name: "视频创作", exact: true }).click();
    await expect(page).toHaveURL(/\/video$/);
    await expect(page.locator(".unified-workspace")).toHaveAttribute("data-tool", "video");
    await expect(page.locator(".workspace-composer-title")).toHaveText("视频创作");
    // The product image from the previous tool becomes the first frame; the last frame is optional.
    await expect(
      page.getByRole("region", { name: "首帧图", exact: true }).locator(".reference-tile"),
    ).toHaveCount(1);
    await expect(page.getByLabel("首帧图文件", { exact: true })).toHaveAttribute("required", "");
    await expect(page.getByLabel("尾帧图文件", { exact: true })).not.toHaveAttribute("required");
    const prompt = page.getByLabel("视频描述", { exact: true });
    await prompt.fill("镜头缓慢推近，床品在晨光中展开");
    await page.getByRole("radio", { name: "16:9", exact: true }).click();
    await page.getByRole("radio", { name: "10 秒", exact: true }).click();
    const submit = page.getByRole("button", { name: "视频生成即将开放", exact: true });
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAccessibleDescription(
      "可先准备首帧图和视频描述，开放后即可直接生成。",
    );
    // Switching tools keeps the video draft.
    await tools.getByRole("button", { name: "主图制作", exact: true }).click();
    await expect(page).toHaveURL(/\/create$/);
    await tools.getByRole("button", { name: "视频创作", exact: true }).click();
    await expect(prompt).toHaveValue("镜头缓慢推近，床品在晨光中展开");
    await expect(page.getByRole("radio", { name: "16:9", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "10 秒", exact: true })).toBeChecked();
    // No video tasks exist yet: the results area says so instead of querying image history.
    if (width < 768) await page.getByRole("radio", { name: "历史记录", exact: true }).click();
    await expect(page.getByRole("region", { name: "工作区历史记录" })).toContainText(
      "生成的视频会显示在这里",
    );
    await page.screenshot({ path: `/tmp/lycobo-video-${width}.png` });
    expect(videoReads).toEqual([]);
    expect(submissions).toEqual([]);
  });
}
