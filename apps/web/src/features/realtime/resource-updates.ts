import type { RealtimeEvent } from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";

/** 合并同一批钱包与消息事件，避免连续事件分别发起相同查询。 */
export function batchResourceUpdates(client: QueryClient, isStopped: () => boolean) {
  const keys = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    enqueue(...resources: string[]) {
      for (const resource of resources) keys.add(resource);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (!isStopped())
          for (const key of keys) void client.invalidateQueries({ queryKey: [key] });
        keys.clear();
      }, 150);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
      keys.clear();
    },
  };
}

/** 发布信息直接入缓存，钱包与消息按资源合并，任务交给详情同步逻辑。 */
export function applyResourceEvent(
  client: QueryClient,
  resources: ReturnType<typeof batchResourceUpdates>,
  event: RealtimeEvent,
) {
  if (event.kind === "release" && event.release)
    client.setQueryData(["site-release"], { release: event.release });
  else if (event.kind === "notification") resources.enqueue("notifications");
  else if (event.kind === "wallet") resources.enqueue("wallet", "wallet-entries");
  else return false;
  return true;
}
