import { type VariationPlan, variationPlanSchema } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import { variationService } from "./variation-service";

function fixture(replayed = false) {
  const scope = { organizationId: crypto.randomUUID(), userId: crypto.randomUUID() };
  const input = { description: "橙色商品图", referenceAssetIds: [] };
  const plan: VariationPlan = { id: crypto.randomUUID(), status: "running", ...input, items: [] };
  const sequence: string[] = [];
  const repository: Parameters<typeof variationService>[0]["repository"] = {
    asset: async () => null,
    variation: {
      config: async () => ({
        origin: "https://api.deepseek.com",
        protocol: "openai-chat",
        model: "deepseek-flash",
        timeoutMs: 1000,
        ciphertext: "unused",
      }),
      begin: async () => ({ plan, replayed }),
      finish: async (_scope, _id, items) => {
        sequence.push("saved");
        plan.status = "ready";
        plan.items = variationPlanSchema.parse({ ...plan, items }).items;
      },
      get: async () => plan,
    },
  };
  const request = vi.fn<typeof fetch>(
    async () =>
      new Response(
        'data: {"choices":[{"delta":{"content":"{\\"items\\":[{\\"title\\":\\"橙色\\",\\"prompt\\":\\"保留结构，将主色改为橙色。\\"}]}"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  return {
    scope,
    input,
    plan,
    sequence,
    request,
    service: variationService({ repository, plannerKey: "fixture", plannerRequest: request }),
  };
}
it("emits preview before saving but only returns a persisted final plan", async () => {
  const f = fixture();
  const result = await f.service.create(
    f.scope,
    f.input,
    "key",
    new AbortController().signal,
    async () => {
      f.sequence.push("preview");
    },
  );
  expect(f.sequence).toEqual(["preview", "saved"]);
  expect(result?.status).toBe("ready");
  expect(result?.items).toHaveLength(1);
});
it("replays existing requests without another provider call or preview", async () => {
  const f = fixture(true);
  const preview = vi.fn();
  expect(
    await f.service.create(f.scope, f.input, "key", new AbortController().signal, preview),
  ).toBe(f.plan);
  expect(f.request).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();
});
