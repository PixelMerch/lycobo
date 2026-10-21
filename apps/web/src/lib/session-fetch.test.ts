import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const response = (status: number, expiresAt?: number) =>
  new Response("{}", {
    status,
    headers: expiresAt ? { "X-Auth-Expires-At": String(expiresAt) } : {},
  });
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
describe("cookie session renewal", () => {
  it("refreshes before expiry and sends no credential to JavaScript storage", async () => {
    const now = Date.now() / 1000;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(200, now + 100))
      .mockResolvedValueOnce(response(200, now + 86400))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetcher);
    const { sessionFetch, rememberSessionExpiry } = await import("./session-fetch");
    rememberSessionExpiry(response(200, now + 100));
    expect((await sessionFetch("/api/v1/image-tasks")).ok).toBe(true);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/v1/auth/session",
      "/api/v1/auth/refresh",
      "/api/v1/image-tasks",
    ]);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      credentials: "same-origin",
    });
  });
  it("coalesces concurrent expired requests and preserves the paid submission key on retry", async () => {
    let renewed = false;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/refresh")) {
        renewed = true;
        return response(200, Date.now() / 1000 + 86400);
      }
      return response(renewed ? 200 : 401);
    });
    vi.stubGlobal("fetch", fetcher);
    const { sessionFetch } = await import("./session-fetch");
    const init = {
      method: "POST",
      headers: { "Idempotency-Key": "fixture-key" },
      body: "fixture-body",
    };
    const results = await Promise.all([
      sessionFetch("/api/v1/image-tasks", init),
      sessionFetch("/api/v1/image-session", { method: "POST" }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/refresh"))).toHaveLength(1);
    const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/v1/image-tasks");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.[1]).toMatchObject(init);
  });
  it("keeps a rejected refresh unauthorized and never retries a business server error", async () => {
    const fetcher = vi.fn(async () => response(401));
    vi.stubGlobal("fetch", fetcher);
    const { sessionFetch } = await import("./session-fetch");
    expect((await sessionFetch("/api/v1/image-session")).status).toBe(401);
    fetcher.mockClear().mockImplementation(async () => response(500));
    expect((await sessionFetch("/api/v1/image-tasks")).status).toBe(500);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
