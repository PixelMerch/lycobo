import { videoRepository } from "@lycoboai/db";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import type { EnterpriseAuth } from "../auth/service";
import { videoService } from "./service";

const user = {
  userId: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  role: "member" as const,
  account: "fixture",
};
const auth: EnterpriseAuth = {
  config: { secret: "x".repeat(40), origins: ["https://app.test"], secureCookie: true },
  login: async () => ({ error: "INVALID_CREDENTIALS" as const }),
  refresh: async () => null,
  authenticate: async (token) =>
    token === "fixture"
      ? { user, sessionId: crypto.randomUUID(), expiresAt: Date.now() / 1000 + 900 }
      : null,
  changePassword: async () => false,
  setAvatarPreset: async () => false,
  revokeRefresh: async () => {},
  revoke: async () => {},
};
describe("video API", () => {
  it("requires a server-resolved identity and validates input before durable submission", async () => {
    const calls: unknown[] = [];
    const repository = videoRepository(async (operation, args) => {
      calls.push({ operation, args });
      return { id: crypto.randomUUID(), replayed: false };
    });
    const service = videoService({
      repository,
      origin: "https://api.uselg.top",
      key: "never-exposed",
      referencesReady: false,
      sign: async () => ({
        url: "https://asset.test/a",
        thumbnail_url: "https://asset.test/t",
        download_url: "https://asset.test/d",
        expires_at: 9999999999,
      }),
    });
    const app = createApp(undefined, undefined, auth, undefined, { service });
    const capability = await app.request("/api/v1/video-model", {
      headers: { Authorization: "Bearer fixture" },
    });
    expect(await capability.json()).toMatchObject({
      data: { enabled: true, referenceImagesEnabled: false },
    });
    const send = (body: object, authorized = true) =>
      app.request("/api/v1/video-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          ...(authorized ? { Authorization: "Bearer fixture" } : {}),
        },
        body: JSON.stringify(body),
      });
    expect((await send({ prompt: "视频描述", seconds: 10 }, false)).status).toBe(401);
    expect((await send({ prompt: "视频描述", seconds: 31 })).status).toBe(400);
    expect(
      (await send({ prompt: "视频描述", seconds: 10, ownerId: crypto.randomUUID() })).status,
    ).toBe(400);
    for (const prompt of ["", "   ", "@图片1"])
      expect((await send({ prompt, seconds: 10 })).status).toBe(400);
    expect((await send({ seconds: 10 })).status).toBe(400);
    const rejected = await send({
      prompt: "视频描述",
      seconds: 10,
      referenceAssetIds: [crypto.randomUUID()],
    });
    expect(rejected.status).toBe(503);
    expect(await rejected.json()).toMatchObject({
      message: "当前环境无法向视频服务提供参考图。",
      error: { code: "VIDEO_REFERENCES_UNAVAILABLE" },
    });
    expect(calls).toEqual([]);
    const response = await send({ prompt: "视频描述", seconds: 15 });
    expect(response.status).toBe(202);
    const result = z
      .object({ code: z.number(), request_id: z.string() })
      .passthrough()
      .parse(await response.json());
    expect(result.code).toBe(0);
    expect(result.request_id).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("never-exposed");
    expect(calls).toMatchObject([
      {
        operation: "create",
        args: { organizationId: user.organizationId, userId: user.userId, input: { seconds: 15 } },
      },
    ]);
  });
  it("does not apply video auth middleware to unrelated application endpoints", async () => {
    const app = createApp();
    expect((await app.request("/api/health/live")).status).toBe(200);
  });
});
