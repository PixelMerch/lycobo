import { promptOptimization } from "../../apps/api/src/features/images/planning/prompt-optimization";

/** 用 workerd 原生 Request 校验供应商请求选项，不连接真实模型或数据库。 */
export async function optimizerRuntimeProbe() {
  const rewritten = "展示商品主体，保留原有颜色与细节，使用柔和光线。";
  let requests = 0;
  const service = await promptOptimization({
    repository: {
      promptOptimization: {
        finish: async (_scope, _key, result) => ({ status: result ? "ready" : "failed", result }),
      },
      variation: {
        config: async () => ({
          origin: "https://api.deepseek.com/",
          protocol: "openai-chat",
          model: "deepseek-flash",
          timeoutMs: 1000,
        }),
      },
    },
    plannerKey: "isolated-fixture-key",
    plannerRequest: async (input, init) => {
      // Node 的 fetch mock 不校验该选项；必须由 workerd 的 Request 构造器验证。
      new Request(input, init);
      requests++;
      return new Response(
        [
          `data: ${JSON.stringify({ choices: [{ delta: { content: rewritten } }] })}`,
          'data: {"choices":[{"finish_reason":"stop"}]}',
          "data: [DONE]",
          "",
        ].join("\n\n"),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  }).prepare();
  const result = await service.run(
    { userId: crypto.randomUUID(), organizationId: crypto.randomUUID() },
    crypto.randomUUID(),
    { prompt: "商品主图", tool: "create" },
    new AbortController().signal,
    async () => undefined,
  );
  return { optimized: result === rewritten, requests };
}
