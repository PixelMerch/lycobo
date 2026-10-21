import {
  apiErrorSchema,
  apiSuccessSchema,
  capabilitiesSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "./app";

const app = createApp();
describe("API foundation", () => {
  it("reports liveness without claiming database readiness", async () => {
    const r = await app.request("/api/health/live");
    expect(r.status).toBe(200);
    expect(r.headers.get("x-request-id")).toBeTruthy();
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("reports unavailable product capabilities honestly", async () => {
    const r = await app.request("/api/v1/system/capabilities");
    expect(capabilitiesSchema.parse(unwrapApiData(await r.json())).generationEnabled).toBe(false);
  });
  it("rejects invalid input", async () => {
    const r = await app.request("/api/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 100 }),
    });
    expect(r.status).toBe(400);
    expect(apiErrorSchema.parse(await r.json()).error.code).toBe("VALIDATION_ERROR");
  });
  it("never accepts work before required integrations exist", async () => {
    const r = await app.request("/api/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: crypto.randomUUID(),
        referenceAssetIds: [crypto.randomUUID()],
        prompt: "白色背景",
        aspectRatio: "1:1",
        count: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    expect(r.status).toBe(503);
    expect(apiErrorSchema.parse(await r.json()).error.code).toBe("GENERATION_NOT_CONFIGURED");
  });
  it("limits large payloads", async () => {
    const r = await app.request("/api/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "a".repeat(40_000) }),
    });
    expect(r.status).toBe(413);
  });
  it("returns a structured 404", async () => {
    const r = await app.request("/api/missing");
    expect(r.status).toBe(404);
    expect(apiErrorSchema.parse(await r.json()).error.code).toBe("NOT_FOUND");
  });
});

it("uses one UUID envelope for successful health, failures and payload limits", async () => {
  const ok = await app.request("/api/health/live", { headers: { "X-Request-Id": "untrusted" } });
  const success = apiSuccessSchema(
    z.object({ status: z.literal("ok"), service: z.string() }),
  ).parse(await ok.json());
  expect(success.code).toBe(0);
  expect(success.message).toBe("成功");
  expect(success.error).toEqual({});
  expect(success.request_id).toBe(ok.headers.get("X-Request-Id"));
  const failed = await app.request("/api/v1/auth/session");
  const error = apiErrorSchema.parse(await failed.json());
  expect(error.code).toBe(40002);
  expect(error.data).toEqual({});
  expect(error.request_id).toBe(failed.headers.get("X-Request-Id"));
  const limited = await app.request("/api/v1/auth/enterprise/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "a".repeat(40000) }),
  });
  expect(apiErrorSchema.parse(await limited.json()).code).toBe(10003);
});
it("wraps unexpected failures without leaking internal exception messages", async () => {
  const errors: { requestId: string; name: string }[] = [];
  const broken = createApp((event) => errors.push(event));
  broken.get("/api/fixture-error", () => {
    throw new Error("private-error-detail");
  });
  const response = await broken.request("/api/fixture-error");
  expect(response.status).toBe(500);
  const error = apiErrorSchema.parse(await response.json());
  expect(error.code).toBe(50000);
  expect(JSON.stringify(error)).not.toContain("private-error-detail");
  expect(errors[0]?.requestId).toBe(error.request_id);
});
