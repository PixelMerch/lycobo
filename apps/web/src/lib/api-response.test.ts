import { afterEach, expect, it, vi } from "vitest";
import { completeApiResponse } from "../../server/api-binding-response";
import { useLocaleStore } from "../i18n/locale-store";
import { normalizeApiResponse } from "./api-response";

afterEach(() => vi.restoreAllMocks());
it("rejects truncated binding JSON before forwarding a successful response", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(
    completeApiResponse(
      new Response('{"data":"private', { headers: { "Content-Type": "application/json" } }),
    ),
  ).rejects.toThrow("API_RESPONSE_INVALID");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private");
});
it("preserves cookies and avoids a stale length after buffering JSON", async () => {
  const response = await completeApiResponse(
    new Response('{"data":"完整内容"}', {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "1",
        "Set-Cookie": "session=example; HttpOnly",
      },
    }),
  );
  expect(await response.json()).toEqual({ data: "完整内容" });
  expect(response.headers.get("Content-Length")).toBeNull();
  expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
});
it("does not buffer event streams or downloads", async () => {
  const response = new Response("event: ready\n\n", {
    headers: { "Content-Type": "text/event-stream" },
  });
  expect(await completeApiResponse(response)).toBe(response);
});
it("reports truncated client JSON safely without showing parser internals", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  useLocaleStore.setState({ locale: "zh-CN" });
  await expect(
    normalizeApiResponse(
      new Response('{"data":"private', { headers: { "Content-Type": "application/json" } }),
    ),
  ).rejects.toThrow("响应未完整接收");
  useLocaleStore.setState({ locale: "en" });
  await expect(
    normalizeApiResponse(
      new Response('{"data":"private', { headers: { "Content-Type": "application/json" } }),
    ),
  ).rejects.toThrow("The response didn't arrive in full");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private");
});
it("correlates an interrupted upstream body without leaking the stream error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const body = new ReadableStream({
    start(controller) {
      controller.error(new Error("private database details"));
    },
  });
  await expect(
    completeApiResponse(
      new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "36b7aa18-a1e1-4bd2-a2d3-271cd6f7bf51",
        },
      }),
    ),
  ).rejects.toThrow("API_RESPONSE_UNAVAILABLE");
  expect(log).toHaveBeenCalledWith({
    event: "PAGES_API_BODY_UNAVAILABLE",
    status: 200,
    requestId: "36b7aa18-a1e1-4bd2-a2d3-271cd6f7bf51",
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain("private");
});
