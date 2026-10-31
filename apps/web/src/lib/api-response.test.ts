import { afterEach, expect, it, vi } from "vitest";
import { completeApiResponse } from "../../server/api-binding-response";
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
  await expect(
    normalizeApiResponse(
      new Response('{"data":"private', { headers: { "Content-Type": "application/json" } }),
    ),
  ).rejects.toThrow("响应未完整接收");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private");
});
