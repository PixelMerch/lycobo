import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { textileItemInput } from "./textile-generation";
import { planVariation } from "./variation-planner";

const config = {
  protocol: "openai-chat" as const,
  origin: "https://language.example.com",
  model: "gpt-6-luna",
  timeoutMs: 5000,
  key: "fixture-only",
};
const input = { description: "换成橙色和蓝色，保留白色部分", referenceAssetIds: [] };
const reply = (items: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items }) } }],
    }),
  );
describe("variation planner", () => {
  it("sends vision JSON server-side and maps each plan to exactly one image", async () => {
    let calls = 0;
    const request: typeof fetch = async (url, init) => {
      calls++;
      expect(String(url)).toBe("https://language.example.com/v1/chat/completions");
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("same-analysis");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gpt-6-luna");
      expect(body.messages[1].content[2].image_url.url).toBe("data:image/png;base64,AQID");
      return reply([
        { title: "橙色", prompt: "参考图1，将主色换成橙色，保留白色。" },
        { title: "蓝色", prompt: "参考图1，将主色换成蓝色，保留白色。" },
      ]);
    };
    const items = await planVariation(
      input,
      [new Uint8Array([1, 2, 3])],
      config,
      "same-analysis",
      undefined,
      request,
    );
    const job = imageGenerationInputSchema.parse({
      model: "gpt-image-2.5",
      prompt: "智能裂变",
      count: 2,
      variation: { version: 1, planId: crypto.randomUUID(), items },
    });
    expect(textileItemInput(job, 0)).toMatchObject({
      count: 1,
      prompt: expect.stringContaining("橙色"),
    });
    expect(textileItemInput(job, 1)).toMatchObject({
      count: 1,
      prompt: expect.stringContaining("蓝色"),
    });
    expect(textileItemInput(job, 1)).not.toHaveProperty("variation");
    expect(calls).toBe(1);
  });
  it("never automatically resubmits ambiguous analysis", async () => {
    let calls = 0;
    const request: typeof fetch = async () => {
      calls++;
      throw new Error("network");
    };
    await expect(planVariation(input, [], config, "key", undefined, request)).rejects.toMatchObject(
      { code: "PLANNER_OUTCOME_UNKNOWN" },
    );
    expect(calls).toBe(1);
  });
  it("rejects duplicate, empty and oversized plans", async () => {
    for (const items of [
      [],
      Array.from({ length: 11 }, (_, i) => ({
        title: String(i),
        prompt: `独立的商品摄影需求${i}`,
      })),
      [
        { title: "a", prompt: "重复的商品摄影需求" },
        { title: "b", prompt: "重复的商品摄影需求" },
      ],
    ]) {
      await expect(
        planVariation(input, [], config, "key", undefined, async () => reply(items)),
      ).rejects.toMatchObject({ code: "PLANNER_INVALID_RESULT" });
    }
  });
});

it("accepts native Claude vision plans inside a single JSON code fence", async () => {
  const request: typeof fetch = async (url, init) => {
    expect(String(url)).toBe("https://language.example.com/v1/messages");
    expect(new Headers(init?.headers).get("x-api-key")).toBe("fixture-only");
    const body = JSON.parse(String(init?.body));
    expect(body.max_tokens).toBe(6000);
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body.messages[0].content[2]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AQID" },
    });
    return new Response(
      JSON.stringify({
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text:
              "```json\n" +
              JSON.stringify({
                items: [{ title: "橙色", prompt: "保留原商品外形与白色区域，只修改主色为橙色。" }],
              }) +
              "\n```",
          },
        ],
      }),
    );
  };
  const items = await planVariation(
    input,
    [new Uint8Array([1, 2, 3])],
    { ...config, model: "claude-sonnet-5", protocol: "anthropic-messages" },
    "key",
    undefined,
    request,
  );
  expect(items).toHaveLength(1);
});
