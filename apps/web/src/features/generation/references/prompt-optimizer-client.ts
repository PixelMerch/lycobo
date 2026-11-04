import { ImageApiError, imageRequest } from "../generation-client";

export const promptOptimizeCredits = 1;
export type PromptOptimizeTool = "create" | "variation" | "video";

export class PromptOptimizeRejected extends Error {}
class PromptOptimizeError extends Error {}

/** Forwards `delta` text until `complete`; a stream that ends any other way has failed. */
export async function readOptimizedPrompt(response: Response, onText: (text: string) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new PromptOptimizeError("优化结果为空，请稍后重试");
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = buffer.indexOf("\n");
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trimEnd();
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf("\n");
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (!line.startsWith("data:")) continue;
        if (event === "failed") throw new PromptOptimizeRejected("提示词优化失败，已退还积分");
        if (event === "interrupted")
          throw new PromptOptimizeError("优化连接已中断，请重试以核对结果");
        if (event !== "delta" && event !== "complete") continue;
        const value: unknown = JSON.parse(line.slice(5));
        if (
          value &&
          typeof value === "object" &&
          "text" in value &&
          typeof value.text === "string"
        ) {
          if (event === "complete") return value.text;
          onText(value.text);
        }
      }
    }
    throw new PromptOptimizeError("连接已中断，请稍后重试");
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function requestPromptOptimization({
  prompt,
  tool,
  signal,
  key,
  onText,
}: {
  prompt: string;
  tool: PromptOptimizeTool;
  signal: AbortSignal;
  key: string;
  onText: (text: string) => void;
}) {
  const response = await imageRequest(
    "prompt-optimizations",
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ prompt, tool }),
    },
    60_000,
  );
  return readOptimizedPrompt(response, onText);
}

export function promptOptimizeFailure(error: unknown) {
  if (error instanceof ImageApiError && error.status === 404) return "提示词优化暂未开放";
  if (
    error instanceof ImageApiError ||
    error instanceof PromptOptimizeError ||
    error instanceof PromptOptimizeRejected
  )
    return error.message;
  return "提示词优化失败，请稍后重试";
}
