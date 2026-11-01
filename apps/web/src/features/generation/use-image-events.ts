import {
  imageEventCursorSchema,
  imageEventSchema,
  imageJobSchema,
  imageTasksResponseSchema,
} from "@lycoboai/contracts";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { imageRequest, useImageModels, useImageSession } from "./generation-client";
import {
  cachedJob,
  chargesChanged,
  pollDelay,
  reconnectPlan,
  refreshUnfinished,
  replaceJob,
  unfinishedJobs,
} from "./task-sync";

const fetchJob = (client: QueryClient, id: string) =>
  client.fetchQuery({
    queryKey: ["image-task", id],
    staleTime: 0,
    queryFn: async ({ signal }) =>
      imageJobSchema.parse(await (await imageRequest(`image-tasks/${id}`, { signal })).json()),
  });
/** Keeps task, wallet and asset caches current: SSE when offered, otherwise task polling. */
export function useImageEvents() {
  const session = useImageSession();
  const models = useImageModels();
  const client = useQueryClient();
  const userId = session.data?.userId;
  const organizationId = session.data?.organizationId;
  const enabled = models.data?.eventsEnabled;
  useEffect(() => {
    if (!userId || !organizationId || !session.isSuccess || enabled === undefined) {
      return;
    }
    if (!enabled || typeof EventSource === "undefined") {
      return;
    }
    let stopped = false;
    let source: EventSource | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let batchTimer: ReturnType<typeof setTimeout> | undefined;
    let walletTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshWallet = () => {
      if (walletTimer) return;
      walletTimer = setTimeout(() => {
        walletTimer = undefined;
        if (stopped) return;
        void client.invalidateQueries({ queryKey: ["wallet"] });
        void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      }, 500);
    };
    let cursor = "0";
    let failures = 0;
    let connectedAt: number | undefined;
    let flushing = false;
    let calibration = 0;
    let assetsChanged = false;
    const taskIds = new Set<string>();
    const calibrate = () => {
      calibration++;
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      void client.invalidateQueries({ queryKey: ["image-tasks"] });
      void client.invalidateQueries({ queryKey: ["image-task"] });
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
      let walletChanged = false;
      let reloadAssets = updateAssets;
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const previous = cachedJob(client, id);
          const job = await fetchJob(client, id);
          if (stopped) return;
          if (snapshot !== calibration) {
            taskIds.add(id);
            return;
          }
          if (taskIds.has(id)) return;
          if (chargesChanged(previous, job)) walletChanged = true;
          if (!replaceJob(client, job)) reloadHistory = true;
          if (job.items.some((item) => item.output_asset_id)) reloadAssets = true;
        }),
      );
      if (!stopped) {
        if (walletChanged) refreshWallet();
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
        connectedAt = Date.now();
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
      clearTimeout(walletTimer);
    };
  }, [client, userId, organizationId, enabled, session.isSuccess]);
  // Polls only unfinished tasks in a visible tab: nothing reaches the API or database while idle.
  // Behind a live event stream the same loop is a slow safety net for lost events.
  useEffect(() => {
    if (!userId || !organizationId || !session.isSuccess || enabled === undefined) return;
    let stopped = false;
    let polling = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (stopped || polling || timer || document.visibilityState === "hidden") return;
      const jobs = unfinishedJobs(client);
      if (jobs.length)
        timer = setTimeout(() => void poll(), pollDelay(jobs, enabled, failures, Date.now()));
    };
    const poll = async () => {
      clearTimeout(timer);
      timer = undefined;
      if (stopped || polling || document.visibilityState === "hidden") return;
      const jobs = unfinishedJobs(client);
      if (!jobs.length) return;
      polling = true;
      const results = new Map<string, ReturnType<typeof imageJobSchema.parse>>();
      const failed = new Set<string>();
      // Bounded sequential batches avoid both per-task round trips and an unbounded fan-out.
      for (let offset = 0; offset < jobs.length && !stopped; offset += 50) {
        const batch = jobs.slice(offset, offset + 50);
        try {
          const ids = batch.map((job) => job.id).join(",");
          const response = imageTasksResponseSchema.parse(
            await (await imageRequest(`image-tasks/status?ids=${ids}`)).json(),
          );
          if (stopped) return;
          for (const job of response.data) {
            results.set(job.id, job);
            client.setQueryData(["image-task", job.id], job);
          }
        } catch {
          for (const job of batch) failed.add(job.id);
        }
      }
      if (stopped) return;
      const followUp = await refreshUnfinished(client, jobs, async (id) => {
        if (failed.has(id)) throw new Error("TASK_BATCH_UNAVAILABLE");
        return results.get(id) ?? null;
      });
      polling = false;
      if (stopped) return;
      failures = followUp.failed ? failures + 1 : 0;
      if (followUp.wallet) {
        void client.invalidateQueries({ queryKey: ["wallet"] });
        void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      }
      if (followUp.history) void client.invalidateQueries({ queryKey: ["image-tasks"] });
      if (followUp.assets) void client.invalidateQueries({ queryKey: ["image-assets"] });
      schedule();
    };
    const unsubscribe = client.getQueryCache().subscribe(({ query }) => {
      const [key] = query.queryKey;
      if (key === "image-tasks" || key === "image-task") schedule();
    });
    const onVisibility = () => void poll();
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [client, userId, organizationId, enabled, session.isSuccess]);
}
