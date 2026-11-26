import { z } from "zod";
import { type GenerationModerator, ModerationError } from "./service";

const responseSchema = z.object({
  id: z.string().min(1),
  object: z.literal("moderation_result"),
  decision: z.enum(["allow", "flag", "deny"]),
});

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
  return responseSchema.parse(JSON.parse(new TextDecoder().decode(buffer.subarray(0, offset))));
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
  return async (prompts, requestId, signal, separateApprovals) => {
    if (env.CREEM_MODERATION_ENABLED !== "true" || !key?.startsWith("creem_"))
      throw new ModerationError("MODERATION_UNAVAILABLE");
    // 逐图扣费需要独立审核 ID，纯审核模式可复用相同文案的审核结果。
    const uniquePrompts = separateApprovals ? prompts : [...new Set(prompts)];
    const approvals: string[] = [];
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
      if (decisions.some(({ decision }) => decision !== "allow"))
        throw new ModerationError("CONTENT_REJECTED");
      approvals.push(...decisions.map(({ id }) => id));
    }
    if (deadline.aborted) throw new ModerationError("MODERATION_UNAVAILABLE");
    return approvals;
  };
}
