import { type ImageScope, imageEventCursorSchema } from "@lycoboai/contracts";
import type { ImageEventFeed } from "@lycoboai/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

type Options = { heartbeatMs?: number; maxAgeMs?: number };
/** 隔离 Node 环境按事务事件发送 SSE，并在断线时释放订阅。 */
export async function imageEventStream(
  c: Context,
  feed: ImageEventFeed,
  scope: ImageScope,
  authorize: () => Promise<boolean>,
  options: Options = {},
) {
  const supplied = c.req.header("Last-Event-ID") ?? c.req.query("cursor") ?? "0";
  const parsed = imageEventCursorSchema.safeParse(supplied);
  if (!parsed.success)
    return c.json(
      {
        error: { code: "VALIDATION_ERROR", message: "事件游标无效", requestId: c.get("requestId") },
      },
      400,
    );
  let cursor = parsed.data;
  let dirty = false;
  let calibrated = false;
  let resyncRequired = false;
  let wake: (() => void) | undefined;
  const unsubscribe = await feed.subscribe((organizationId) => {
    if (organizationId === null || organizationId === scope.organizationId) {
      dirty = true;
      if (organizationId === null && calibrated) resyncRequired = true;
      wake?.();
    }
  });
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("X-Accel-Buffering", "no");
  return streamSSE(
    c,
    async (stream) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let lifetime: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;
      const cleanup = () => {
        stopped = true;
        unsubscribe();
        clearTimeout(timer);
        clearTimeout(lifetime);
        wake?.();
      };
      stream.onAbort(cleanup);
      lifetime = setTimeout(
        () => {
          cleanup();
          stream.abort();
        },
        options.maxAgeMs ?? 10 * 60 * 1000,
      );
      const started = Date.now();
      const heartbeatMs = options.heartbeatMs ?? 15000;
      let lastAuthCheck = 0;
      const authorized = async () => {
        if (stopped || feed.isClosed()) return false;
        if (!(await authorize())) {
          await stream.writeSSE({ event: "auth-expired", data: "{}" });
          return false;
        }
        lastAuthCheck = Date.now();
        return true;
      };
      const flush = async () => {
        if (!(await authorized())) return false;
        if (resyncRequired) {
          resyncRequired = false;
          cursor = await feed.latest(scope);
          await stream.writeSSE({ event: "resync", id: cursor, data: "{}" });
        }
        const rows = await feed.since(scope, cursor);
        if (rows.length > 200) {
          cursor = await feed.latest(scope);
          await stream.writeSSE({ event: "resync", id: cursor, data: "{}" });
        } else
          for (const event of rows) {
            await stream.writeSSE({
              event: "image.updated",
              id: event.id,
              data: JSON.stringify(event),
            });
            cursor = event.id;
          }
        return true;
      };
      const isActive = () => !stopped && !stream.aborted && !feed.isClosed();
      async function waitForWake() {
        await new Promise<void>((resolve) => {
          wake = resolve;
          timer = setTimeout(resolve, heartbeatMs);
          if (dirty || stopped) resolve();
        });
        clearTimeout(timer);
        wake = undefined;
      }
      async function heartbeat() {
        if (!isActive() || Date.now() - started >= (options.maxAgeMs ?? 10 * 60 * 1000)) {
          return false;
        }
        if (Date.now() - lastAuthCheck >= 60000 && !(await authorized())) return false;
        if (!dirty) await stream.writeSSE({ event: "heartbeat", data: "{}" });
        return true;
      }
      async function nextCycle() {
        if (dirty) {
          dirty = false;
          return flush();
        }
        await waitForWake();
        return heartbeat();
      }
      try {
        const latest = await feed.latest(scope);
        if (cursor === "0" || BigInt(cursor) > BigInt(latest)) cursor = latest;
        if (!(await flush())) return;
        // 首次连接校准当前状态，兼容日志保留期及数据库恢复造成的游标变化。
        await stream.writeSSE({ event: "ready", id: cursor, data: "{}", retry: 3000 });
        calibrated = true;
        while (isActive()) {
          if (!(await nextCycle())) break;
        }
      } finally {
        cleanup();
      }
    },
    async (_error, stream) => {
      unsubscribe();
      stream.abort();
    },
  );
}
