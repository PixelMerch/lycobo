import { z } from "zod";

const responseSchema = z.object({
  id: z.string().min(1),
  object: z.literal("moderation_result"),
  decision: z.enum(["allow", "flag", "deny"]),
});

const errors = {
  CONTENT_REJECTED: { status: 400, message: "提示词未通过审核，请修改后重试。" },
  MODERATION_UNAVAILABLE: { status: 503, message: "内容审核暂不可用，请稍后重试。" },
} as const;

/** 审核失败只携带固定错误码，避免暴露提示词、密钥和服务商响应。 */
export class ModerationError extends Error {
  readonly failure;

  constructor(readonly code: keyof typeof errors) {
    super(code);
    this.failure = errors[code];
  }
}

export type GenerationModerator = (
  prompts: readonly string[],
  requestId: string,
  signal: AbortSignal,
) => Promise<void>;

const batchSize = 4;
const timeoutMs = 5000;
const replyLimit = 64 * 1024;

async function readDecision(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ModerationError("MODERATION_UNAVAILABLE");
  const buffer = new Uint8Array(replyLimit);
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > replyLimit)
        throw new ModerationError("MODERATION_UNAVAILABLE");
      buffer.set(value, offset);
      offset += value.byteLength;
    }
  } finally {
    await reader.cancel();
  }
  return responseSchema.parse(JSON.parse(new TextDecoder().decode(buffer.subarray(0, offset))))
    .decision;
}

async function screenPrompt(
  request: typeof fetch,
  url: string,
  key: string,
  prompt: string,
  externalId: string,
  signal: AbortSignal,
) {
  try {
    const response = await request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ prompt, external_id: externalId }),
      signal,
      // 重定向会让请求离开固定的 Creem 域名。
      redirect: "manual",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ModerationError("MODERATION_UNAVAILABLE");
    }
    return await readDecision(response);
  } catch {
    throw new ModerationError("MODERATION_UNAVAILABLE");
  }
}

/** 从服务端配置创建审核器；开启后密钥缺失、超时或审核失败均阻止生成。 */
export function createCreemModerator(
  env: { CREEM_MODERATION_ENABLED?: string | undefined; CREEM_API_KEY?: string | undefined },
  request: typeof fetch = fetch,
): GenerationModerator | undefined {
  if (!env.CREEM_MODERATION_ENABLED || env.CREEM_MODERATION_ENABLED === "false") return undefined;
  const key = env.CREEM_API_KEY?.trim();
  const origin = key?.startsWith("creem_test_")
    ? "https://test-api.creem.io"
    : "https://api.creem.io";
  return async (prompts, requestId, signal) => {
    if (env.CREEM_MODERATION_ENABLED !== "true" || !key?.startsWith("creem_"))
      throw new ModerationError("MODERATION_UNAVAILABLE");
    // 同次申请的相同文案只审核一次。限制并发，超时预算覆盖整批。
    const uniquePrompts = [...new Set(prompts)];
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    for (let start = 0; start < uniquePrompts.length; start += batchSize) {
      const decisions = await Promise.all(
        uniquePrompts
          .slice(start, start + batchSize)
          .map((prompt, index) =>
            screenPrompt(
              request,
              `${origin}/v1/moderation/prompt`,
              key,
              prompt,
              `${requestId}:${start + index + 1}`,
              deadline,
            ),
          ),
      );
      if (decisions.some((decision) => decision !== "allow"))
        throw new ModerationError("CONTENT_REJECTED");
    }
    if (deadline.aborted) throw new ModerationError("MODERATION_UNAVAILABLE");
  };
}
