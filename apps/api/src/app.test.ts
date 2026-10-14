import { apiErrorSchema, capabilitiesSchema } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
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
    expect(capabilitiesSchema.parse(await r.json()).generationEnabled).toBe(false);
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
