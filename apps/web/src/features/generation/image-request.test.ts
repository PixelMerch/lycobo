import { beforeEach, expect, it, vi } from "vitest";
import { useLocaleStore } from "../../i18n/locale-store";
import { currentMessages } from "../../i18n/messages";
import { sessionFetch } from "../../lib/session-fetch";
import { generationMessages } from "./generation-messages";
import { imageRequest } from "./image-request";

vi.mock("../../lib/session-fetch", () => ({ sessionFetch: vi.fn() }));

beforeEach(() => {
  useLocaleStore.setState({ locale: "zh-CN" });
  vi.mocked(sessionFetch).mockReset();
});

it.each(["zh-CN", "en"] as const)(
  "does not call a temporary HTML 503 disabled in %s",
  async (locale) => {
    useLocaleStore.setState({ locale });
    vi.mocked(sessionFetch).mockResolvedValue(
      new Response("<html>Unavailable</html>", { status: 503 }),
    );
    await expect(imageRequest("image-tasks")).rejects.toMatchObject({
      status: 503,
      message: currentMessages(generationMessages).serviceUnavailable,
    });
    expect(sessionFetch).toHaveBeenCalledTimes(1);
  },
);

it("preserves an explicit server configuration error", async () => {
  vi.mocked(sessionFetch).mockResolvedValue(
    Response.json(
      {
        request_id: crypto.randomUUID(),
        code: 50001,
        message: "生图服务尚未启用",
        data: {},
        error: { code: "GENERATION_NOT_CONFIGURED" },
      },
      { status: 503 },
    ),
  );
  await expect(imageRequest("image-tasks")).rejects.toMatchObject({
    status: 503,
    businessCode: "GENERATION_NOT_CONFIGURED",
    message: "生图服务尚未启用",
  });
});

it("localizes a network failure without retrying a paid submission", async () => {
  vi.mocked(sessionFetch).mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(imageRequest("image-tasks", { method: "POST" })).rejects.toMatchObject({
    message: currentMessages(generationMessages).networkError,
  });
  expect(sessionFetch).toHaveBeenCalledTimes(1);
});

it("distinguishes timeout from intentional cancellation", async () => {
  vi.mocked(sessionFetch).mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
  await expect(imageRequest("image-models")).rejects.toMatchObject({
    message: currentMessages(generationMessages).requestTimeout,
  });
  const controller = new AbortController();
  controller.abort();
  vi.mocked(sessionFetch).mockRejectedValueOnce(controller.signal.reason);
  await expect(imageRequest("image-models", { signal: controller.signal })).rejects.toBe(
    controller.signal.reason,
  );
});
