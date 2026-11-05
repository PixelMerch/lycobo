import { variationPlanSchema } from "@lycoboai/contracts";
import { readEventData } from "../../../lib/read-event-data";

function readPlanStage(value: unknown) {
  if (!value || typeof value !== "object" || !("stage" in value)) return undefined;
  const { stage } = value;
  if (stage === "reading" || stage === "planning" || stage === "link_failed") return stage;
  return undefined;
}

function readPlanText(value: unknown) {
  if (!value || typeof value !== "object" || !("text" in value) || typeof value.text !== "string") {
    throw new Error("计划响应格式无效");
  }
  return value.text;
}

export async function readPlanResponse(
  response: Response,
  onText: (text: string) => void,
  onStatus?: (stage: "reading" | "planning" | "link_failed") => void,
) {
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return variationPlanSchema.parse(await response.json());
  const reader = response.body?.getReader();
  if (!reader) throw new Error("计划响应为空，请稍后重试");
  let bytes = 0;
  const events = readEventData(reader, (size) => {
    bytes += size;
    if (bytes > 1024 * 1024) throw new Error("计划内容过长，请缩小需求范围");
  });
  for await (const { event, data } of events) {
    const value: unknown = JSON.parse(data);
    if (event === "complete") return variationPlanSchema.parse(value);
    if (event === "failed") throw new Error("计划未完成，请稍后重试");
    if (event === "delta") onText(readPlanText(value));
    if (event === "status") {
      const stage = readPlanStage(value);
      if (stage) onStatus?.(stage);
    }
  }
  throw new Error("连接已中断，请稍后继续获取计划");
}

function readStringToken(text: string, start: number) {
  let raw = "";
  let end = start + 1;
  for (; end < text.length; end++) {
    const character = text[end];
    if (character === '"') break;
    if (character === "\\") {
      if (end + 1 >= text.length) break;
      raw += character + text[++end];
    } else raw += character;
  }
  try {
    return { end, value: parseString(raw) };
  } catch {
    // A Unicode escape can itself be split across transport chunks.
    try {
      return { end, value: parseString(raw.replace(/\\u[0-9a-f]{0,3}$/i, "")) };
    } catch {
      return undefined;
    }
  }
}

function parseString(raw: string) {
  const parsed: unknown = JSON.parse(`"${raw}"`);
  return typeof parsed === "string" ? parsed : "";
}

type PreviewItem = { id: string; title: string; prompt: string };
type PlanField = "title" | "prompt";

function planField(text: string, end: number, value: string): PlanField | undefined {
  if (text[end] !== '"' || !/^\s*:/.test(text.slice(end + 1))) return undefined;
  return value === "title" || value === "prompt" ? value : undefined;
}

function applyPreviewField(items: PreviewItem[], field: PlanField, start: number, value: string) {
  if (field === "title" && items.length < 20) {
    items.push({ id: `token-${start}`, title: value, prompt: "" });
  }
  const last = items.at(-1);
  if (field === "prompt" && last) last.prompt = value;
}

/** Read only JSON string tokens, including the last unfinished string, for a read-only preview. */
export function previewPlanItems(text: string) {
  const items: PreviewItem[] = [];
  let field: PlanField | undefined;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    const tokenStart = i;
    const token = readStringToken(text, i);
    if (!token) break;
    i = token.end;
    const { value } = token;
    if (!field) {
      field = planField(text, i, value);
      continue;
    }
    applyPreviewField(items, field, tokenStart, value);
    field = undefined;
  }
  return items;
}
