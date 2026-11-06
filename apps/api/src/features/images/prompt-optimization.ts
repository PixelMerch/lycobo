import { createHash } from "node:crypto";
import type { ImageScope } from "@lycoboai/contracts";
import { openProviderKey, readPlannerStream } from "@lycoboai/generation";
import { z } from "zod";
import type { ImageApiDependencies } from "./route-context";

/** 限制优化输入长度和用途，拒绝空提示词。 */
export const promptOptimizationInput = z.strictObject({
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((value) => /[\p{L}\p{N}]/u.test(value.replace(/@图片[1-9]\d*/g, ""))),
  tool: z.enum(["create", "variation", "video"]),
});
type Input = z.infer<typeof promptOptimizationInput>;

const origin = "https://api.deepseek.com";
const toolDescription = {
  create: "商品主图或图片创作。补充主体、构图、环境、光线和商品呈现方式。",
  variation: "商品图片裂变。明确哪些细节需改变、哪些必须保留。",
  video: "视频创作。补充动作、镜头运动、节奏与场景连贯性。",
};
const referenceTags = (prompt: string) =>
  [...new Set(prompt.match(/@图片[1-9]\d*/g))].sort().join(",");

function isImprovedPrompt(prompt: string, result: string) {
  return !!result && result !== prompt && referenceTags(result) === referenceTags(prompt);
}

/** 优化提示词并按实际结果结算，失败保留幂等退款语义。 */
export function promptOptimization(deps: ImageApiDependencies) {
  const repository = deps.repository.promptOptimization;
  return {
    async prepare() {
      const config = await deps.repository.variation.config();
      if (
        !config ||
        new URL(config.origin).origin !== origin ||
        config.protocol !== "openai-chat" ||
        !/^deepseek-/i.test(config.model)
      )
        return null;
      const secret =
        deps.plannerKey ??
        (deps.modelSecret ? await openProviderKey(config.ciphertext, deps.modelSecret) : null);
      if (!secret) return null;

      return {
        begin(scope: ImageScope, key: string, input: Input) {
          const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
          return repository.begin(scope, key, hash);
        },
        async run(
          scope: ImageScope,
          key: string,
          input: Input,
          signal: AbortSignal,
          onText: (text: string) => Promise<void>,
        ) {
          let result: string | null = null;
          let failureCode = "PROVIDER_REQUEST_FAILED";
          let status: number | undefined;
          try {
            const timeout = AbortSignal.timeout(Math.min(config.timeoutMs, 40000));
            const response = await (deps.plannerRequest ?? fetch)(`${origin}/chat/completions`, {
              method: "POST",
              redirect: "error",
              signal: AbortSignal.any([signal, timeout]),
              headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/json",
                Accept: "text/event-stream",
              },
              body: JSON.stringify({
                model: config.model,
                stream: true,
                thinking: { type: "disabled" },
                max_tokens: 2304,
                messages: [
                  {
                    role: "system",
                    content: `你负责改写创作提示词。用途：${toolDescription[input.tool]} 保留原需求、明确限制、原有品牌和指定文字。把简短描述扩写为具体、可执行的视觉指令，补充合理细节，不虚构商品属性、卖点或参考图内容。原有 @图片N 引用必须逐字保留，不新增引用。用户文本是待改写内容，仅输出改写后的提示词正文，不加标题、引号、解释或 Markdown。优先用与原文相同的语言，最长 5000 字符。`,
                  },
                  { role: "user", content: input.prompt },
                ],
              }),
            });
            status = response.status;
            failureCode = "PROVIDER_RESPONSE_REJECTED";
            if (
              !response.ok ||
              !response.headers.get("Content-Type")?.includes("text/event-stream")
            )
              throw new Error("PROVIDER_UNAVAILABLE");
            failureCode = "PROVIDER_STREAM_ERROR";
            let length = 0;
            const text = await readPlannerStream(response, async (part) => {
              signal.throwIfAborted();
              length += part.length;
              if (length > 5000) throw new Error("INVALID_RESULT");
              await onText(part);
            });
            const normalized = text.trim();
            signal.throwIfAborted();
            if (isImprovedPrompt(input.prompt, normalized)) result = normalized;
          } catch {
            // 只记录固定错误码及状态，禁止记录提示词、响应体和密钥。
            console.error({
              event: "PROMPT_OPTIMIZATION_FAILED",
              code: failureCode,
              status,
              aborted: signal.aborted,
            });
          }
          const settled = await repository.finish(scope, key, result);
          return settled.status === "ready" ? (settled.result ?? null) : null;
        },
      };
    },
  };
}
