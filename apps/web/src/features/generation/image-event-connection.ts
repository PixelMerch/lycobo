import { imageEventCursorSchema, imageEventSchema } from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { imageRequest } from "./generation-client";
import { batchImageUpdates } from "./image-event-updates";
import { reconnectPlan } from "./task-sync";

export function connectImageEvents(client: QueryClient) {
  let stopped = false;
  let source: EventSource | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let cursor = "0";
  let failures = 0;
  let connectedAt: number | undefined;
  const updates = batchImageUpdates(client, () => stopped);
  const restart = () => {
    if (connectedAt !== undefined && Date.now() - connectedAt >= 60000) failures = 0;
    connectedAt = undefined;
    source?.close();
    source = undefined;
    clearTimeout(watchdog);
    if (stopped || reconnectTimer) return;
    const plan = reconnectPlan(++failures);
    // A refreshed capability without events turns this effect off and cancels the reconnect.
    if (plan.recheck) void client.invalidateQueries({ queryKey: ["image-models"] });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect(true);
    }, plan.delay);
  };
  const touch = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(restart, 45000);
  };
  async function refreshIdentity() {
    try {
      await imageRequest("image-session", { method: "POST" });
    } catch {
      if (!stopped) {
        void client.invalidateQueries({ queryKey: ["enterprise-session"] });
        void client.invalidateQueries({ queryKey: ["image-session"] });
        restart();
      }
      return false;
    }
    return true;
  }
  const connect = async (reauthenticate = false) => {
    if (stopped) return;
    if (reauthenticate && !(await refreshIdentity())) return;
    if (stopped) return;
    const active = new EventSource(`/api/v1/image-events?cursor=${cursor}`);
    source = active;
    const current = () => !stopped && source === active;
    function resetCursor(message: Event, ready: boolean) {
      if (!current() || !(message instanceof MessageEvent)) return;
      const parsed = imageEventCursorSchema.safeParse(message.lastEventId);
      if (!parsed.success) {
        restart();
        return;
      }
      cursor = parsed.data;
      if (ready) connectedAt = Date.now();
      touch();
      updates.calibrate();
    }
    active.addEventListener("ready", (message) => resetCursor(message, true));
    active.addEventListener("image.updated", (message) => {
      if (!current() || !(message instanceof MessageEvent) || typeof message.data !== "string")
        return;
      try {
        const event = imageEventSchema.parse(JSON.parse(message.data));
        touch();
        if (BigInt(event.id) <= BigInt(cursor)) return;
        cursor = event.id;
        updates.enqueue(event);
      } catch {
        restart();
      }
    });
    active.addEventListener("resync", (message) => resetCursor(message, false));
    active.addEventListener("heartbeat", () => {
      if (current()) touch();
    });
    active.addEventListener("auth-expired", () => {
      if (current()) restart();
    });
    active.onerror = () => {
      if (current()) restart();
    };
    touch();
  };
  void connect();
  return () => {
    stopped = true;
    source?.close();
    clearTimeout(reconnectTimer);
    clearTimeout(watchdog);
    updates.cancel();
  };
}
