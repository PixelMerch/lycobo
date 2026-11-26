import {
  type RealtimeEvent,
  realtimeFrameSchema,
  sessionReplacedCloseCode,
} from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { recheckEnterpriseSession } from "../auth/auth-client";
import { batchImageUpdates } from "../generation/image-event-updates";
import { setRealtimeReady } from "./availability";
import { applyResourceEvent, batchResourceUpdates } from "./resource-updates";

function openSocket(privateChannel: boolean, cursor: string) {
  const url = new URL(`/api/v1/realtime/${privateChannel ? "connect" : "public"}`, location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("cursor", cursor);
  return new WebSocket(url);
}

function readFrame(data: unknown) {
  if (typeof data !== "string") throw new Error("INVALID_REALTIME_FRAME");
  return realtimeFrameSchema.parse(JSON.parse(data));
}

function watchRealtimeResume(
  readState: () => {
    socket: WebSocket | undefined;
    lastPong: number;
    renewAt: number;
    stopped: boolean;
  },
  reconnect: () => void,
  recheck?: () => void,
) {
  const resume = () => {
    const { socket, lastPong, renewAt, stopped } = readState();
    if (document.visibilityState === "hidden" || stopped) return;
    // 回到前台核验登录状态，保持健康连接及原有游标。
    if (
      socket?.readyState === WebSocket.OPEN &&
      Date.now() - lastPong < 60000 &&
      Date.now() < renewAt
    ) {
      recheck?.();
      return;
    }
    reconnect();
  };
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", resume);
  return () => {
    window.removeEventListener("online", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}

/** 共享单条连接，保留健康连接并在断线或到期时按游标恢复。 */
export function connectRealtime(client: QueryClient, privateChannel: boolean) {
  let stopped = false;
  let socket: WebSocket | undefined;
  let cursor = "0";
  let failures = 0;
  let connectedAt: number | undefined;
  let epoch = 0;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let reconnectNeedsSessionCheck = true;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let renewAt = 0;
  let lastPong = Date.now();
  const updates = batchImageUpdates(client, () => stopped);
  const resources = batchResourceUpdates(client, () => stopped);
  const invalidate = (key: string) => void client.invalidateQueries({ queryKey: [key] });
  const apply = (event: RealtimeEvent) => {
    if (applyResourceEvent(client, resources, event)) return;
    if ((event.kind === "task" || event.kind === "asset") && event.resourceId)
      updates.enqueue({ id: "0", kind: event.kind, resourceId: event.resourceId });
  };
  const restart = (replaced = false) => {
    setRealtimeReady(client, false);
    epoch++;
    if (connectedAt !== undefined && Date.now() - connectedAt >= 60000) failures = 0;
    connectedAt = undefined;
    renewAt = 0;
    clearInterval(heartbeat);
    clearTimeout(expiry);
    if (socket) {
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
      socket = undefined;
    }
    if (stopped || reconnect) return;
    const delay = replaced
      ? 0
      : Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)) * (0.8 + Math.random() * 0.4);
    reconnect = setTimeout(() => {
      reconnect = undefined;
      void connect(replaced ? "session-revoked" : "reconnect").catch(() => restart());
    }, delay);
  };
  const receive = (data: unknown) => {
    if (data === "pong") {
      lastPong = Date.now();
      return;
    }
    try {
      const frame = readFrame(data);
      if (frame.type === "session-revoked") return restart(privateChannel);
      if (frame.type === "ready") {
        reconnectNeedsSessionCheck = true;
        setRealtimeReady(client, privateChannel);
        if (frame.resync && privateChannel) {
          updates.calibrate();
          invalidate("notifications");
        }
        cursor = frame.cursor;
        client.setQueryData(["site-release"], { release: frame.release });
        clearTimeout(expiry);
        // 到期前重新握手，通过现有 HttpOnly 刷新机制续期，不在消息里携带令牌。
        renewAt = frame.expiresAt - 60000;
        expiry = setTimeout(restart, Math.max(1000, renewAt - Date.now()));
        connectedAt = Date.now();
      } else if (BigInt(frame.cursor) > BigInt(cursor)) {
        apply(frame.event);
        cursor = frame.cursor;
      }
    } catch {
      restart();
    }
  };
  const connect = async (reason?: "reconnect" | "session-revoked") => {
    if (stopped) return;
    const generation = ++epoch;
    // 已确认被替换时只读取一次当前身份，避免尝试续期已撤销的 Cookie。
    if (reason && privateChannel && (reconnectNeedsSessionCheck || reason === "session-revoked")) {
      const account = await recheckEnterpriseSession(client, reason !== "session-revoked");
      if (stopped || generation !== epoch || !account) return;
      // 同一次断线可能握手失败多次，复用首轮身份核验结果。
      reconnectNeedsSessionCheck = false;
    }
    if (stopped || generation !== epoch) return;
    const active = openSocket(privateChannel, cursor);
    socket = active;
    lastPong = Date.now();
    active.onmessage = (message) => {
      if (socket === active) receive(message.data);
    };
    active.onclose = (event) => {
      if (socket === active) restart(privateChannel && event.code === sessionReplacedCloseCode);
    };
    active.onerror = () => {
      if (socket === active) restart();
    };
    heartbeat = setInterval(() => {
      if (Date.now() - lastPong > 60000) return restart();
      if (active.readyState === WebSocket.OPEN) active.send("ping");
    }, 20000);
  };
  const stopResume = watchRealtimeResume(
    () => ({ socket, lastPong, renewAt, stopped }),
    () => {
      clearTimeout(reconnect);
      reconnect = undefined;
      restart();
    },
    privateChannel
      ? () => {
          // 临时网络错误保留连接，下一次重连或返回前台再核验。
          void recheckEnterpriseSession(client).catch(() => undefined);
        }
      : undefined,
  );
  void connect().catch(() => restart());
  return () => {
    stopped = true;
    clearTimeout(reconnect);
    restart();
    updates.cancel();
    resources.cancel();
    stopResume();
  };
}
