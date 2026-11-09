/**
 * 跨标签回执里固定写入的类型标记：只用于校验存储内容，不显示给用户，所以不随界面语言变化，
 * 改动会让已保存的回执失效。
 */
export const completionReceiptLabel = "图片生成完成";

export type CompletedResult = { id: string; path: string; label: string };
type Receipts = { seen: string[]; pending: CompletedResult[] };
const taskId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const resultPath = /^\/(create|commerce\/(textile-set|smart-variation))\?task=[0-9a-f-]{36}$/i;

function isResult(value: unknown): value is CompletedResult {
  if (!value || typeof value !== "object") return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    taskId.test(value.id) &&
    "path" in value &&
    typeof value.path === "string" &&
    resultPath.test(value.path) &&
    "label" in value &&
    value.label === completionReceiptLabel
  );
}
function isReceipts(value: unknown): value is Receipts {
  if (!value || typeof value !== "object" || !("seen" in value) || !("pending" in value))
    return false;
  return (
    Array.isArray(value.seen) &&
    value.seen.length <= 500 &&
    value.seen.every((id: unknown) => typeof id === "string" && taskId.test(id)) &&
    Array.isArray(value.pending) &&
    value.pending.length <= 100 &&
    value.pending.every(isResult)
  );
}
const emptyReceipts = () => ({ seen: [], pending: [] });

/** 按成员隔离本机回执，只保存任务定位信息，不保存提示词或图片链接。 */
export function completionStorage(scope: string) {
  const key = `lycobo:completion:v1:${scope}`;
  let memory: Receipts = emptyReceipts();
  return {
    key,
    read() {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isReceipts(parsed)) memory = parsed;
        }
      } catch {
        // 浏览器禁止存储时，仍在当前页面内去重。
        return memory;
      }
      return memory;
    },
    write(value: Receipts) {
      memory = { seen: value.seen.slice(-500), pending: value.pending.slice(-100) };
      try {
        localStorage.setItem(key, JSON.stringify(memory));
      } catch {
        return;
      }
    },
  };
}

/** 支持时用同源浏览器锁串行领取提醒，避免多个标签同时处理同一任务。 */
export function claimCompletion<T>(key: string, action: () => T): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(key, action);
  return Promise.resolve(action());
}
