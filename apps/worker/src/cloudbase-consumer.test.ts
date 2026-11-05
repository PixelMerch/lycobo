import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "./cloudbase-consumer";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("CloudBase consumer release boundaries", () => {
  it("rejects a mixed source/CloudBase database configuration before claiming tasks", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://source.invalid/app");
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No external requests permitted"));
    await expect(main()).rejects.toThrow("DATABASE_BACKEND_CONFLICT");
    expect(request).not.toHaveBeenCalled();
  });
  it.each([undefined, "images"] as const)(
    "queues an asynchronous drain with scope %s without database or paid work",
    async (scope) => {
      vi.stubEnv("TENCENTCLOUD_SECRETID", "AKIDfixture");
      vi.stubEnv("TENCENTCLOUD_SECRETKEY", "fixture-secret-key");
      vi.stubEnv("TENCENTCLOUD_REGION", "ap-shanghai");
      vi.stubEnv("SCF_FUNCTIONNAME", "lycobo-consumer");
      vi.stubEnv("CLOUDBASE_ENV_ID", "lycobo-env");
      const request = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json({ Response: { RequestId: "fixture" } }));
      expect(await main({ wake: true, scope })).toEqual({
        enabled: true,
        processed: 0,
        woken: true,
      });
      expect(request).toHaveBeenCalledOnce();
      expect(String(request.mock.calls[0]?.[0])).toBe("https://scf.tencentcloudapi.com/");
      const invocation = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
      expect(invocation.InvocationType).toBe("Event");
      expect(JSON.parse(invocation.ClientContext)).toEqual(
        scope ? { drain: true, scope } : { drain: true },
      );
    },
  );
});
