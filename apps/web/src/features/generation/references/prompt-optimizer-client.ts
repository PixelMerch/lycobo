import { currentMessages } from "../../../i18n/messages";
import { readEventData } from "../../../lib/read-event-data";
import { ImageApiError, imageRequest } from "../generation-client";
import { referencesMessages } from "./references-messages";

export const promptOptimizeCredits = 1;
export type PromptOptimizeTool = "create" | "variation" | "video";

export class PromptOptimizeRejected extends Error {}
class PromptOptimizeError extends Error {}

/** 逐段转发优化结果直到 complete；以其他方式结束的流都算失败。 */
export async function readOptimizedPrompt(response: Response, onText: (text: string) => void) {
  const reader = response.body?.getReader();
  const t = currentMessages(referencesMessages);
  if (!reader) throw new PromptOptimizeError(t.emptyResult);
  for await (const { event, data } of readEventData(reader)) {
    if (event === "failed") throw new PromptOptimizeRejected(t.optimizeRefunded);
    if (event === "interrupted") throw new PromptOptimizeError(t.optimizeInterrupted);
    if (event !== "delta" && event !== "complete") continue;
    const text = promptEventText(data);
    if (text === undefined) continue;
    if (event === "complete") return text;
    onText(text);
  }
  throw new PromptOptimizeError(t.connectionLost);
}

function promptEventText(data: string) {
  const value: unknown = JSON.parse(data);
  if (!value || typeof value !== "object" || !("text" in value)) return undefined;
  return typeof value.text === "string" ? value.text : undefined;
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

/** 提示词优化失败时给用户看的说明。 */
export function promptOptimizeFailure(error: unknown) {
  const t = currentMessages(referencesMessages);
  if (error instanceof ImageApiError && error.status === 404) return t.optimizeUnavailable;
  if (
    error instanceof ImageApiError ||
    error instanceof PromptOptimizeError ||
    error instanceof PromptOptimizeRejected
  )
    return error.message;
  return t.optimizeFailed;
}
