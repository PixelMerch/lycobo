import { z } from "zod";

const chunkSchema = z.object({
  type: z.string().optional(),
  delta: z
    .object({
      type: z.string().optional(),
      text: z.string().optional(),
      stop_reason: z.string().nullable().optional(),
    })
    .optional(),
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().nullable().optional() }).optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

function parsePlannerChunk(data: string) {
  const chunk = chunkSchema.parse(JSON.parse(data));
  if (chunk.type === "error") throw new Error("PROVIDER_ERROR");
  const choice = chunk.choices?.[0];
  const reason = choice?.finish_reason ?? chunk.delta?.stop_reason;
  if (reason && !["stop", "end_turn"].includes(reason)) throw new Error("TRUNCATED");
  const complete = reason === "stop" || reason === "end_turn";
  const text =
    choice?.delta?.content ?? (chunk.delta?.type === "text_delta" ? chunk.delta.text : "");
  return { complete, text };
}

/** Decode bounded provider SSE; only model text is forwarded, never reasoning or metadata. */
export async function readPlannerStream(
  response: Response,
  onText: (text: string) => Promise<void>,
) {
  let content = "";
  let complete = false;
  for await (const data of plannerEventData(response)) {
    const chunk = parsePlannerChunk(data);
    if (chunk.complete) complete = true;
    const { text } = chunk;
    if (text) {
      content += text;
      if (content.length > 256 * 1024) throw new Error("SIZE");
      await onText(text);
    }
  }
  if (!complete) throw new Error("INCOMPLETE");
  return content;
}

async function* plannerEventData(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("EMPTY");
  const decoder = new TextDecoder();
  let buffer = "";
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 1024 * 1024) throw new Error("SIZE");
      buffer += decoder.decode(part.value, { stream: true });
      let boundary = buffer.indexOf("\n");
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trimEnd();
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf("\n");
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data !== "[DONE]") yield data;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
