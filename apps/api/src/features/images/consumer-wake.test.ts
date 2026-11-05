import { expect, it, vi } from "vitest";
import { cloudbaseConsumerWake } from "./consumer-wake";

const config = { CLOUDBASE_ENV_ID: "lycobo-env", CLOUDBASE_APIKEY: "fixture-key" };
it.each([undefined, "images"] as const)(
  "queues a drain with scope %s and no task data",
  async (scope) => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ enabled: true, processed: 0, woken: true }),
    );
    expect(await cloudbaseConsumerWake(config, "lycobo-consumer", request)(scope)).toBe(true);
    const [url, init] = request.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://lycobo-env.api.tcloudbasegateway.com/v1/functions/lycobo-consumer",
    );
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture-key");
    expect(JSON.parse(String(init?.body))).toEqual(scope ? { wake: true, scope } : { wake: true });
  },
);
it("reports refused, unqueued and unreachable wakes as failures without throwing", async () => {
  for (const response of [
    async () => new Response(null, { status: 403 }),
    async () => Response.json({ enabled: true, processed: 0, woken: false }),
    async () => Response.json({ code: "FUNCTIONS_INVOCATION_FAILED" }),
    async () => {
      throw new Error("offline");
    },
  ])
    expect(await cloudbaseConsumerWake(config, "lycobo-consumer", vi.fn(response))()).toBe(false);
});
