import { expect, it, vi } from "vitest";
import { createPlannerWebReader, plannerUrls } from "./planner-web";

const content =
  "商品：纯棉床盖，菱形绗缝。可机洗。此段文字来自公开商品页面，仅用于规划商品图片，不包含图片理解。";
it("extracts and deduplicates URLs without reading plain prompts", () => {
  expect(plannerUrls("生成一张床盖主图")).toEqual([]);
  expect(
    plannerUrls("参考 https://shop.example/item。以及 https://shop.example/item#details"),
  ).toEqual(["https://shop.example/item"]);
  for (const url of [
    "http://127.0.0.1",
    "http://localhost",
    "https://u:p@shop.example/x",
    "https://shop.example:123/x",
    "http://[::1]/",
  ]) {
    expect(() => plannerUrls(url)).toThrow();
  }
  expect(() =>
    plannerUrls("https://a.example https://b.example https://c.example https://d.example"),
  ).toThrow();
});
it("uses only the official Fetch endpoint and caches scoped successful content for five minutes", async () => {
  const request = vi.fn<typeof fetch>(async () => Response.json({ title: "商品", content }));
  let now = 0;
  const read = createPlannerWebReader(request, () => now);
  const signal = new AbortController().signal;
  await read(["https://shop.example/item"], "test-key", "user-a", signal);
  await read(["https://shop.example/item"], "test-key", "user-a", signal);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]?.[0]).toBe("https://api.deepseek.com/v1/tools/fetch");
  expect(request.mock.calls[0]?.[1]).toMatchObject({
    redirect: "manual",
    body: JSON.stringify({ url: "https://shop.example/item" }),
  });
  await read(["https://shop.example/item"], "test-key", "user-b", signal);
  expect(request).toHaveBeenCalledTimes(2);
  now = 300001;
  await read(["https://shop.example/item"], "test-key", "user-a", signal);
  expect(request).toHaveBeenCalledTimes(3);
});
it.each([302, 401, 402, 403, 404, 429, 504])(
  "rejects Fetch %s without retrying or caching failures",
  async (status) => {
    const request = vi.fn<typeof fetch>(
      async () => new Response("private provider error", { status }),
    );
    const read = createPlannerWebReader(request);
    await expect(
      read(["https://shop.example"], "key", "user", new AbortController().signal),
    ).rejects.toThrow("网页读取未完成");
    expect(request).toHaveBeenCalledTimes(1);
  },
);
it("rejects empty, challenge and oversized responses", async () => {
  for (const response of [
    Response.json({ title: "empty", content: "" }),
    Response.json({ title: "Captcha", content }),
    Response.json({ title: "huge", content: "a".repeat(1024 * 1024) }),
  ]) {
    await expect(
      createPlannerWebReader(async () => response)(
        ["https://shop.example"],
        "key",
        "user",
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  }
});
it("does not request after cancellation", async () => {
  const request = vi.fn<typeof fetch>();
  await expect(
    createPlannerWebReader(request)(["https://shop.example"], "key", "user", AbortSignal.abort()),
  ).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it("propagates request cancellation and never returns a cancelled page", async () => {
  const controller = new AbortController();
  const request = vi.fn<typeof fetch>(
    async (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        controller.abort();
      }),
  );
  await expect(
    createPlannerWebReader(request)(["https://shop.example"], "key", "user", controller.signal),
  ).rejects.toThrow("网页读取未完成");
});
