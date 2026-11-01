import { describe, expect, it } from "vitest";
import { planVariation } from "./variation-planner";

const config = {
  origin: "https://api.deepseek.com",
  protocol: "openai-chat" as const,
  model: "deepseek-flash",
  key: "fixture",
  timeoutMs: 1000,
};
const input = { description: "橙色商品", referenceAssetIds: [] };
const sse = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\n`;
describe("streamed planner", () => {
  it("forwards real text before validating the final plan, including split UTF8", async () => {
    const content = JSON.stringify({
      items: [{ title: "橙色款", prompt: "保留商品结构，主色改为橙色，使用自然光。" }],
    });
    const wire =
      sse(content.slice(0, 20)) +
      sse(content.slice(20)) +
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const bytes = new TextEncoder().encode(wire);
    const parts: string[] = [];
    const result = await planVariation(
      input,
      config,
      "test",
      undefined,
      async (_url, init) => {
        expect(JSON.parse(String(init?.body)).stream).toBe(true);
        return new Response(
          new ReadableStream({
            start(controller) {
              for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
              controller.close();
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      },
      async (text) => {
        parts.push(text);
      },
    );
    expect(parts.join("")).toBe(content);
    expect(parts).toHaveLength(2);
    expect(result[0]?.title).toBe("橙色款");
  });
  it("rejects truncated or disconnected output without resubmission", async () => {
    for (const end of ["", 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n']) {
      let calls = 0;
      await expect(
        planVariation(
          input,
          config,
          "test",
          undefined,
          async () => {
            calls++;
            return new Response(sse('{"items":[]}') + end, {
              headers: { "content-type": "text/event-stream" },
            });
          },
          async () => {},
        ),
      ).rejects.toMatchObject({ code: "PLANNER_INVALID_RESULT" });
      expect(calls).toBe(1);
    }
  });
});
