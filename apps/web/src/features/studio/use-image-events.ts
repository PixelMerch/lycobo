import {
  type ImageJob,
  imageEventCursorSchema,
  imageEventSchema,
  imageJobSchema,
} from "@lycoboai/contracts";
import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { imageRequest, useImageModels, useImageSession } from "./generation-client";
import { useImageEventState } from "./image-event-state";

type History = InfiniteData<{ data: ImageJob[] }, string>;
export function useImageEvents() {
  const session = useImageSession();
  const models = useImageModels();
  const client = useQueryClient();
  const userId = session.data?.userId;
  const organizationId = session.data?.organizationId;
  const enabled = models.data?.eventsEnabled;
  useEffect(() => {
    const setStatus = useImageEventState.getState().setStatus;
    if (!userId || !organizationId || !session.isSuccess || enabled === undefined) {
      setStatus("off");
      return;
    }
    if (!enabled || typeof EventSource === "undefined") {
      setStatus("fallback");
      return;
    }
    let stopped = false;
    let source: EventSource | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let cursor = "0";
    let failures = 0;
    let flushing = false;
    let calibration = 0;
    let assetsChanged = false;
    const taskIds = new Set<string>();
    const calibrate = () => {
      calibration++;
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      void client.invalidateQueries({ queryKey: ["image-tasks"] });
      void client.invalidateQueries({ queryKey: ["image-assets"] });
    };
    const flush = async () => {
      batchTimer = undefined;
      if (stopped || flushing) return;
      flushing = true;
      const snapshot = calibration;
      const ids = [...taskIds];
      taskIds.clear();
      const updateAssets = assetsChanged;
      assetsChanged = false;
      let reloadHistory = false;
      let reloadAssets = updateAssets;
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const job = await client.fetchQuery({
            queryKey: ["image-task", id],
            staleTime: 0,
            queryFn: async ({ signal }) =>
              imageJobSchema.parse(
                await (await imageRequest(`image-tasks/${id}`, { signal })).json(),
              ),
          });
          if (stopped) return;
          if (snapshot !== calibration) {
            taskIds.add(id);
            return;
          }
          if (taskIds.has(id)) return;
          let found = false;
          client.setQueryData<History>(["image-tasks"], (current) => {
            if (!current) return current;
            return {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                data: page.data.map((old) => {
                  if (old.id !== id) return old;
                  found = true;
                  return job;
                }),
              })),
            };
          });
          if (!found) reloadHistory = true;
          if (job.items.some((item) => item.output_asset_id)) reloadAssets = true;
        }),
      );
      if (!stopped) {
        if (ids.length) {
          void client.invalidateQueries({ queryKey: ["wallet"] });
          void client.invalidateQueries({ queryKey: ["wallet-entries"] });
        }
        if (reloadHistory || results.some((result) => result.status === "rejected"))
          void client.invalidateQueries({ queryKey: ["image-tasks"] });
        if (reloadAssets) void client.invalidateQueries({ queryKey: ["image-assets"] });
      }
      flushing = false;
      if (!stopped && (taskIds.size || assetsChanged))
        batchTimer = setTimeout(() => void flush(), 150);
    };
    const schedule = () => {
      if (!flushing && !batchTimer) batchTimer = setTimeout(() => void flush(), 150);
    };
    const restart = () => {
      source?.close();
      source = undefined;
      clearTimeout(watchdog);
      if (stopped || reconnectTimer) return;
      setStatus("fallback");
      reconnectTimer = setTimeout(
        () => {
          reconnectTimer = undefined;
          void connect(true);
        },
        Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)),
      );
    };
    const touch = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(restart, 45000);
    };
    const connect = async (reauthenticate = false) => {
      if (stopped) return;
      if (reauthenticate) {
        try {
          await imageRequest("image-session", { method: "POST" });
        } catch {
          if (!stopped) {
            void client.invalidateQueries({ queryKey: ["enterprise-session"] });
            void client.invalidateQueries({ queryKey: ["image-session"] });
            restart();
          }
          return;
        }
      }
      if (stopped) return;
      setStatus("connecting");
      const active = new EventSource(`/api/v1/image-events?cursor=${cursor}`);
      source = active;
      const current = () => !stopped && source === active;
      active.addEventListener("ready", (message) => {
        if (!current() || !(message instanceof MessageEvent)) return;
        const parsed = imageEventCursorSchema.safeParse(message.lastEventId);
        if (!parsed.success) {
          restart();
          return;
        }
        cursor = parsed.data;
        failures = 0;
        setStatus("live");
        touch();
        calibrate();
      });
      active.addEventListener("image.updated", (message) => {
        if (!current() || !(message instanceof MessageEvent) || typeof message.data !== "string")
          return;
        try {
          const event = imageEventSchema.parse(JSON.parse(message.data));
          touch();
          if (BigInt(event.id) <= BigInt(cursor)) return;
          cursor = event.id;
          if (event.kind === "task") {
            taskIds.add(event.resourceId);
          } else assetsChanged = true;
          schedule();
        } catch {
          restart();
        }
      });
      active.addEventListener("resync", (message) => {
        if (!current() || !(message instanceof MessageEvent)) return;
        const parsed = imageEventCursorSchema.safeParse(message.lastEventId);
        if (!parsed.success) {
          restart();
          return;
        }
        cursor = parsed.data;
        touch();
        calibrate();
      });
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
      clearTimeout(batchTimer);
      setStatus("off");
    };
  }, [client, userId, organizationId, enabled, session.isSuccess]);
}
