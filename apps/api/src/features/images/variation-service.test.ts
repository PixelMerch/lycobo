import { type VariationPlan, variationPlanSchema } from "@lycoboai/contracts";
import { expect, it, vi } from "vitest";
import { variationService } from "./variation-service";

function fixture(replayed = false, webStatus = 200, origin = "https://api.deepseek.com") {
  const scope = { organizationId: crypto.randomUUID(), userId: crypto.randomUUID() };
  const input = { description: "橙色商品图", referenceAssetIds: [] };
  const plan: VariationPlan = { id: crypto.randomUUID(), status: "running", ...input, items: [] };
  const sequence: string[] = [];
  const repository: Parameters<typeof variationService>[0]["repository"] = {
    asset: async () => null,
    variation: {
      config: async () => ({
        origin,
        protocol: "openai-chat",
        model: "deepseek-flash",
        timeoutMs: 1000,
        ciphertext: "unused",
      }),
      begin: async () => ({ plan, replayed }),
      finish: async (_scope, _id, items, error) => {
        sequence.push("saved");
        plan.status = error ? "failed" : "ready";
        plan.items = variationPlanSchema.parse({ ...plan, items }).items;
      },
      get: async () => plan,
    },
  };
  const request = vi.fn<typeof fetch>(async (url) => {
    if (String(url).endsWith("/v1/tools/fetch"))
      return webStatus === 200
        ? Response.json({
            title: "商品页面",
            content:
              "这是一款奶油白菱形绗缝床盖，纯棉面料，可以机洗，适合卧室搭配。商品页面提供的描述仅作规划参考。",
          })
        : new Response("error", { status: webStatus });
    return new Response(
      'data: {"choices":[{"delta":{"content":"{\\"items\\":[{\\"title\\":\\"橙色\\",\\"prompt\\":\\"保留结构，将主色改为橙色。\\"}]}"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
  });
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
  f.input.description = "https://shop.example/item";
  const preview = vi.fn();
  expect(
    await f.service.create(f.scope, f.input, "key", new AbortController().signal, preview),
  ).toBe(f.plan);
  expect(f.request).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();
});

it("reads with DeepSeek before planning and preserves original persisted input", async () => {
  const f = fixture();
  f.input.description = "参考 https://shop.example/item 生成一张床盖图";
  const status = vi.fn();
  await f.service.create(
    f.scope,
    f.input,
    "key",
    new AbortController().signal,
    async () => {},
    status,
  );
  expect(status.mock.calls.map(([stage]) => stage)).toEqual(["reading", "planning"]);
  expect(f.request).toHaveBeenCalledTimes(2);
  const body = String(f.request.mock.calls[1]?.[1]?.body);
  expect(body).toContain("奶油白菱形绗缝床盖");
  expect(body).toContain(f.input.description);
  expect(f.plan.description).toBe("橙色商品图"); // fixture begin snapshot was not replaced by fetched content
  expect(f.plan.status).toBe("ready");
});
it("fails durably without a model call when DeepSeek cannot read the page", async () => {
  const f = fixture(false, 404);
  f.input.description = "参考 https://shop.example/item";
  const status = vi.fn();
  await f.service.create(
    f.scope,
    f.input,
    "key",
    new AbortController().signal,
    async () => {},
    status,
  );
  expect(status.mock.calls.map(([stage]) => stage)).toEqual(["reading", "link_failed"]);
  expect(f.request).toHaveBeenCalledTimes(1);
  expect(f.plan.status).toBe("failed");
});

it("never sends a third-party provider credential to DeepSeek Fetch", async () => {
  const f = fixture(false, 200, "https://relay.example");
  f.input.description = "https://shop.example/item";
  await f.service.create(f.scope, f.input, "key", new AbortController().signal);
  expect(f.request).not.toHaveBeenCalled();
  expect(f.plan.status).toBe("failed");
});
