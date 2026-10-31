import { afterEach, expect, it, vi } from "vitest";
import { reportRequestFailure } from "./request-diagnostics";

afterEach(() => vi.restoreAllMocks());
it("correlates errors without logging query credentials or response bodies", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const requestId = "36b7aa18-a1e1-4bd2-a2d3-271cd6f7bf51";
  reportRequestFailure(
    "/api/v1/image-tasks/36b7aa18-a1e1-4bd2-a2d3-271cd6f7bf51?token=secret",
    "POST",
    new Response("private provider response", {
      status: 503,
      headers: { "X-Request-Id": requestId },
    }),
  );
  expect(log).toHaveBeenCalledWith({
    event: "API_REQUEST_FAILED",
    method: "POST",
    path: "/api/v1/image-tasks/:id",
    status: 503,
    requestId,
  });
});
it("ignores normal anonymous session checks and reports failed actions", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  reportRequestFailure("/api/v1/auth/session", "GET", new Response(null, { status: 401 }));
  expect(log).not.toHaveBeenCalled();
  reportRequestFailure(
    "/api/v1/auth/enterprise/login",
    "POST",
    new Response(null, { status: 401 }),
  );
  expect(log).toHaveBeenCalledOnce();
});
