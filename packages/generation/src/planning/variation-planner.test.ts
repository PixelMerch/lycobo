import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { describe, expect, it } from "vitest";
import { textileItemInput } from "../images/textile-generation";
import { planVariation } from "./variation-planner";

const config = {
  protocol: "openai-chat" as const,
  origin: "https://language.example.com",
  model: "gpt-6-luna",
  timeoutMs: 5000,
  key: "fixture-only",
};
const input = {
  description: "换成橙色和蓝色，保留白色部分",
  referenceAssetIds: [crypto.randomUUID()],
};
const reply = (items: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ items }) } }],
    }),
  );
describe("variation planner", () => {
  it("sends text-only JSON server-side and maps each plan to exactly one image", async () => {
    let calls = 0;
    const request: typeof fetch = async (url, init) => {
      calls++;
      expect(String(url)).toBe("https://language.example.com/v1/chat/completions");
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("same-analysis");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("gpt-6-luna");
      expect(body.messages[1].content).toContain(input.description);
      expect(body.messages[1].content).toContain("参考图1");
      expect(JSON.stringify(body)).not.toMatch(/image_url|data:image|base64/);
      return reply([
        { title: "橙色", prompt: "参考图1，将主色换成橙色，保留白色。" },
        { title: "蓝色", prompt: "参考图1，将主色换成蓝色，保留白色。" },
      ]);
    };
    const items = await planVariation(input, config, "same-analysis", undefined, request);
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
    await expect(planVariation(input, config, "key", undefined, request)).rejects.toMatchObject({
      code: "PLANNER_OUTCOME_UNKNOWN",
    });
    expect(calls).toBe(1);
  });
  it("rejects duplicate, empty and oversized plans", async () => {
    for (const items of [
      [],
      Array.from({ length: 21 }, (_, i) => ({
        title: String(i),
        prompt: `独立的商品摄影需求${i}`,
      })),
      [
        { title: "a", prompt: "重复的商品摄影需求" },
        { title: "b", prompt: "重复的商品摄影需求" },
      ],
    ]) {
      await expect(
        planVariation(input, config, "key", undefined, async () => reply(items)),
      ).rejects.toMatchObject({ code: "PLANNER_INVALID_RESULT" });
    }
  });
});

it("accepts native Claude text-only plans inside a single JSON code fence", async () => {
  const request: typeof fetch = async (url, init) => {
    expect(String(url)).toBe("https://language.example.com/v1/messages");
    expect(new Headers(init?.headers).get("x-api-key")).toBe("fixture-only");
    const body = JSON.parse(String(init?.body));
    expect(body.max_tokens).toBe(6000);
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(typeof body.messages[0].content).toBe("string");
    expect(body.messages[0].content).toContain(input.description);
    expect(JSON.stringify(body)).not.toMatch(/image_url|data:image|base64/);
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
    { ...config, model: "claude-sonnet-5", protocol: "anthropic-messages" },
    "key",
    undefined,
    request,
  );
  expect(items).toHaveLength(1);
});

it("uses the official DeepSeek text-only endpoint with bounded non-thinking JSON output", async () => {
  let calls = 0;
  const request: typeof fetch = async (url, init) => {
    calls++;
    expect(String(url)).toBe("https://api.deepseek.com/chat/completions");
    expect(init?.redirect).toBe("manual");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer fixture-only");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: "deepseek-flash",
      thinking: { type: "disabled" },
      max_tokens: 8192,
      response_format: { type: "json_object" },
      stream: false,
    });
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(typeof body.messages[1].content).toBe("string");
    expect(body.messages[1].content).toContain(input.description);
    expect(body.messages[1].content).toContain("参考图1");
    expect(JSON.stringify(body)).not.toMatch(/image_url|data:image|base64/);
    return reply(
      Array.from({ length: 20 }, (_, i) => ({
        title: `方案${i + 1}`,
        prompt: `参考图1，保留商品主体和白色区域，生成第${i + 1}种独立商品摄影方案。`,
      })),
    );
  };
  const items = await planVariation(
    input,
    {
      ...config,
      model: "deepseek-flash",
      origin: "https://api.deepseek.com/",
    },
    "deepseek-plan",
    undefined,
    request,
  );
  expect(items).toHaveLength(20);
  expect(calls).toBe(1);
});

it.each(["length", "stop"])(
  "rejects truncated or blank DeepSeek JSON without automatic retries (%s)",
  async (finishReason) => {
    let calls = 0;
    const request: typeof fetch = async () => {
      calls++;
      return new Response(
        JSON.stringify({ choices: [{ finish_reason: finishReason, message: { content: "  " } }] }),
      );
    };
    await expect(
      planVariation(
        input,
        {
          ...config,
          model: "deepseek-flash",
          origin: "https://api.deepseek.com/",
        },
        "deepseek-invalid",
        undefined,
        request,
      ),
    ).rejects.toMatchObject({ code: "PLANNER_INVALID_RESULT" });
    expect(calls).toBe(1);
  },
);

it("plans with reference numbers before uploads exist and never sends image content", async () => {
  const request: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    expect(body.messages[1].content).toContain("参考图1、参考图2");
    expect(JSON.stringify(body)).not.toMatch(/image_url|data:image|base64/);
    return reply([{ title: "商品", prompt: "参考图1与参考图2，保留主体材质，柔和自然光。" }]);
  };
  const items = await planVariation(
    { description: "生成一张商品图", referenceAssetIds: [], referenceCount: 2 },
    config,
    "count-only",
    undefined,
    request,
  );
  expect(items).toHaveLength(1);
});
