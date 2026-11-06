import type { QueryClient } from "@tanstack/react-query";

const readyClients = new WeakSet<QueryClient>();

/** 仅将已完成私人通道握手的客户端视为可接收业务推送。 */
export function setRealtimeReady(client: QueryClient, ready: boolean) {
  if (ready) readyClients.add(client);
  else readyClients.delete(client);
}
/** 推送可用时不让操作回执再发起一次相同的资源刷新。 */
export function isRealtimeReady(client: QueryClient) {
  return readyClients.has(client);
}

/** 连接中断时保留操作回执校准；在线时使用同一笔事务的推送事件。 */
export function refreshWithoutRealtime(client: QueryClient, ...keys: string[]) {
  if (isRealtimeReady(client)) return;
  for (const key of keys) void client.invalidateQueries({ queryKey: [key] });
}
