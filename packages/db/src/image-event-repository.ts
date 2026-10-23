import { type ImageScope, imageEventSchema } from "@lycoboai/contracts";
import postgres from "postgres";
import { z } from "zod";

const channel = "lycobo_image_events";
// Call last in each business transaction. The per-tenant lock keeps committed cursors ordered.
export async function recordImageEvent(
  tx: postgres.TransactionSql,
  organizationId: string,
  kind: "task" | "asset",
  resourceId: string,
) {
  await tx`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 71420))`;
  await tx`insert into generation_events (organization_id,kind,resource_id) values (${organizationId},${kind},${resourceId})`;
  await tx`select pg_notify(${channel}, ${organizationId})`;
}
export function openImageEventFeed(url: string, pollOrganizationId?: string) {
  const sql = postgres(url, {
    max: pollOrganizationId ? 1 : 2,
    fetch_types: !pollOrganizationId,
    idle_timeout: 20,
    connect_timeout: 5,
    connection: { statement_timeout: 10000, lock_timeout: 5000 },
  });
  const listeners = new Set<(organizationId: string | null) => void>();
  let starting: Promise<unknown> | undefined;
  let closed = false;
  const emit = (organizationId: string | null) => {
    for (const listener of listeners) listener(organizationId);
  };
  const timers = new Set<ReturnType<typeof setInterval>>();
  const ready = async () => {
    if (closed) throw new Error("EVENT_FEED_CLOSED");
    if (pollOrganizationId) return;
    starting ??= sql
      .listen(
        channel,
        (payload) => {
          const parsed = z.uuid().safeParse(payload);
          if (parsed.success) emit(parsed.data);
        },
        () => emit(null),
      )
      .catch(() => {
        starting = undefined;
        throw new Error("EVENT_FEED_UNAVAILABLE");
      });
    await starting;
  };
  return {
    isClosed: () => closed,
    ready,
    async subscribe(listener: (organizationId: string | null) => void) {
      if (closed) throw new Error("EVENT_FEED_CLOSED");
      if (pollOrganizationId) {
        const timer = setInterval(() => listener(pollOrganizationId), 3000);
        timers.add(timer);
        return () => {
          clearInterval(timer);
          timers.delete(timer);
        };
      }
      listeners.add(listener);
      try {
        await ready();
      } catch (error) {
        listeners.delete(listener);
        throw error;
      }
      return () => {
        listeners.delete(listener);
      };
    },
    async latest(scope: ImageScope) {
      const rows =
        await sql`select id::text as id from generation_events where organization_id=${scope.organizationId} order by id desc limit 1`;
      return String(rows[0]?.id ?? "0");
    },
    async since(scope: ImageScope, after: string) {
      const rows =
        await sql`select id::text as id,kind,resource_id as "resourceId" from generation_events
        where organization_id=${scope.organizationId} and id>${after} order by id limit 201`;
      return rows.map((row) => imageEventSchema.parse(row));
    },
    async close() {
      closed = true;
      emit(null);
      listeners.clear();
      for (const timer of timers) clearInterval(timer);
      timers.clear();
      await sql.end({ timeout: 5 });
    },
  };
}
export type ImageEventFeed = ReturnType<typeof openImageEventFeed>;
