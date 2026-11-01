import { variationPlanSchema } from "@lycoboai/contracts";

export async function readPlanResponse(response: Response, onText: (text: string) => void) {
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return variationPlanSchema.parse(await response.json());
  const reader = response.body?.getReader();
  if (!reader) throw new Error("计划响应为空，请稍后重试");
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1024 * 1024) throw new Error("计划内容过长，请缩小需求范围");
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = buffer.indexOf("\n");
      while (boundary >= 0) {
        const line = buffer.slice(0, boundary).trimEnd();
        buffer = buffer.slice(boundary + 1);
        boundary = buffer.indexOf("\n");
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (!line.startsWith("data:")) continue;
        const value: unknown = JSON.parse(line.slice(5));
        if (event === "delta") {
          if (
            !value ||
            typeof value !== "object" ||
            !("text" in value) ||
            typeof value.text !== "string"
          )
            throw new Error("计划响应格式无效");
          onText(value.text);
        }
        if (event === "complete") return variationPlanSchema.parse(value);
        if (event === "failed") throw new Error("计划未完成，请稍后重试");
      }
    }
    throw new Error("连接已中断，请稍后继续获取计划");
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** Read only JSON string tokens, including the last unfinished string, for a read-only preview. */
export function previewPlanItems(text: string) {
  const items: Array<{ id: string; title: string; prompt: string }> = [];
  let field: "title" | "prompt" | undefined;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    const tokenStart = i;
    let raw = "";
    let closed = false;
    for (i++; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        closed = true;
        break;
      }
      if (ch === "\\") {
        if (i + 1 >= text.length) break;
        raw += ch + text[++i];
      } else raw += ch;
    }
    let value = "";
    try {
      value = JSON.parse(`"${raw}"`);
    } catch {
      // A Unicode escape can itself be split across transport chunks.
      try {
        value = JSON.parse(`"${raw.replace(/\\u[0-9a-f]{0,3}$/i, "")}"`);
      } catch {
        break;
      }
    }
    if (field) {
      if (field === "title" && items.length < 20)
        items.push({ id: `token-${tokenStart}`, title: value, prompt: "" });
      if (field === "prompt" && items.length) {
        const item = items.at(-1);
        if (item) item.prompt = value;
      }
      field = undefined;
    } else if (
      closed &&
      /^\s*:/.test(text.slice(i + 1)) &&
      (value === "title" || value === "prompt")
    ) {
      field = value;
    }
  }
  return items;
}
