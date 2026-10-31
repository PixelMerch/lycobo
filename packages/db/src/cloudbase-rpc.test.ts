import { describe, expect, it, vi } from "vitest";
import { cloudbaseAuthRepository } from "./cloudbase-auth-repository";
import { cloudbaseRpc, readCloudBaseDatabaseConfig } from "./cloudbase-rpc";

const config = { CLOUDBASE_ENV_ID: "example-test", CLOUDBASE_APIKEY: "private-server-key" };
describe("CloudBase server data plane", () => {
  it("rejects partial credentials and untrusted environment names", () => {
    expect(readCloudBaseDatabaseConfig({})).toBeNull();
    expect(() => cloudbaseRpc({ CLOUDBASE_ENV_ID: "example-test" })).toThrow(
      "CLOUDBASE_DATABASE_NOT_CONFIGURED",
    );
    expect(() => cloudbaseRpc({ ...config, CLOUDBASE_ENV_ID: "evil.example/path" })).toThrow();
  });
  it("does not follow redirects or retry ambiguous session mutations", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private upstream body", { status: 503 }));
    const call = cloudbaseRpc(config, request);
    await expect(call("lycobo_auth_rotate_refresh", { p_current_hash: "secret" })).rejects.toThrow(
      "DATABASE_UNAVAILABLE",
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual", method: "POST" });
  });
  it("rejects malformed identities instead of treating them as authenticated", async () => {
    const call = cloudbaseRpc(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ uid: "wrong" })),
    );
    await expect(
      cloudbaseAuthRepository(call).identity("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow();
  });
  it("preserves null identities and parses refresh expiry timestamps", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(
        Response.json({
          id: "00000000-0000-0000-0000-000000000000",
          expires_at: "2026-11-01T00:00:00Z",
        }),
      );
    const repository = cloudbaseAuthRepository(cloudbaseRpc(config, request));
    expect(await repository.identity("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect((await repository.rotateRefresh("old", "next"))?.expires_at).toEqual(
      new Date("2026-11-01T00:00:00Z"),
    );
  });
});
