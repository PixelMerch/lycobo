import { imageEventCursorSchema, imageEventSchema } from "@lycoboai/contracts";
import { z } from "zod";
import { type CloudBaseDatabaseBindings, type CloudBaseRpc, cloudbaseRpc } from "./cloudbase-rpc";
import type { ImageEventFeed } from "./image-event-repository";

/** Durable per-tenant cursors; polling needs no native LISTEN/TCP connection. */
export function cloudbaseImageEventFeed(call: CloudBaseRpc): ImageEventFeed {
  let closed = false;
  const subscriptions = new Map<ReturnType<typeof setInterval>, () => void>();
  const ready = async () => {
    if (closed) throw new Error("EVENT_FEED_CLOSED");
  };
  return {
    isClosed: () => closed,
    ready,
    async subscribe(listener, organizationId) {
      await ready();
      const org = z.uuid().parse(organizationId);
      const timer = setInterval(() => listener(org), 3000);
      subscriptions.set(timer, () => listener(null));
      return () => {
        clearInterval(timer);
        subscriptions.delete(timer);
      };
    },
    async latest(scope) {
      await ready();
      return imageEventCursorSchema.parse(
        await call("lycobo_image_operation", { p_operation: "eventsLatest", p_args: scope }),
      );
    },
    async since(scope, after) {
      await ready();
      return z.array(imageEventSchema).parse(
        await call("lycobo_image_operation", {
          p_operation: "eventsSince",
          p_args: { ...scope, after: imageEventCursorSchema.parse(after) },
        }),
      );
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const [timer, wake] of subscriptions) {
        clearInterval(timer);
        wake();
      }
      subscriptions.clear();
    },
  };
}
export function openCloudBaseImageEventFeed(
  env: CloudBaseDatabaseBindings,
  request: typeof fetch = fetch,
) {
  return cloudbaseImageEventFeed(cloudbaseRpc(env, request));
}
