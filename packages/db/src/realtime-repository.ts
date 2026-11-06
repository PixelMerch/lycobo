import type { ImageScope } from "@lycoboai/contracts";
import { notificationListSchema, realtimeEventSchema, releaseSchema } from "@lycoboai/contracts";
import postgres from "postgres";
import { z } from "zod";

/** 调用级实时仓储：数据库保留投递意图，DO 只承担传输与短期回放。 */
export function openRealtimeRepository(url: string) {
  const sql = postgres(url, {
    max: 1,
    fetch_types: false,
    connect_timeout: 10,
    connection: { statement_timeout: 10000, lock_timeout: 5000 },
  });
  return {
    async pending(limit = 100) {
      const rows = await sql`select id,channel,user_id as "userId",event from realtime_outbox
        where delivered_at is null order by created_at,id limit ${limit}`;
      return rows.map((row) =>
        z
          .object({
            id: z.uuid(),
            channel: z.string(),
            userId: z.uuid().nullable(),
            event: realtimeEventSchema,
          })
          .parse(row),
      );
    },
    async delivered(id: string) {
      await sql`update realtime_outbox set delivered_at=now() where id=${id} and delivered_at is null`;
    },
    async sessions(organizationId: string) {
      const rows = await sql`select s.id from enterprise_sessions s
        join enterprise_accounts a on a.id=s.account_id
        join organization_members m on m.organization_id=a.organization_id and m.user_id=a.user_id
        where a.organization_id=${organizationId} and s.revoked_at is null and s.expires_at>now()
        and a.disabled_at is null and s.credential_version=a.credential_version`;
      return rows.map((row) => z.uuid().parse(row.id));
    },
    async release() {
      const [row] =
        await sql`select payload from realtime_releases order by published_at desc limit 1`;
      return row ? releaseSchema.parse(row.payload) : null;
    },
    async notifications(scope: ImageScope, before?: string) {
      const rows =
        await sql`select n.id,n.title,n.body,n.created_at as "createdAt",r.notification_id is not null as read
        from realtime_notifications n left join realtime_notification_reads r
        on r.notification_id=n.id and r.user_id=${scope.userId}
        where n.organization_id=${scope.organizationId} and (n.user_id is null or n.user_id=${scope.userId})
        ${
          before
            ? sql`and (n.created_at,n.id)<(select created_at,id from realtime_notifications
          where id=${before} and organization_id=${scope.organizationId} and (user_id is null or user_id=${scope.userId}))`
            : sql``
        }
        order by n.created_at desc,n.id desc limit 101`;
      const [count] = await sql`select count(*)::integer as unread from realtime_notifications n
        where n.organization_id=${scope.organizationId} and (n.user_id is null or n.user_id=${scope.userId})
        and not exists (select 1 from realtime_notification_reads r where r.notification_id=n.id and r.user_id=${scope.userId})`;
      return notificationListSchema.parse({
        data: rows
          .slice(0, 100)
          .map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })),
        unread: count?.unread ?? 0,
        nextCursor: rows.length > 100 ? String(rows[99]?.id) : null,
      });
    },
    async read(scope: ImageScope, id: string) {
      return sql.begin(async (tx) => {
        const rows = await tx`insert into realtime_notification_reads (notification_id,user_id)
          select id,${scope.userId} from realtime_notifications
          where id=${id} and organization_id=${scope.organizationId} and (user_id is null or user_id=${scope.userId})
          on conflict do nothing returning notification_id`;
        if (rows.length)
          await tx`insert into realtime_outbox (channel,user_id,event)
          values (${scope.organizationId},${scope.userId},${tx.json({ id: crypto.randomUUID(), kind: "notification" })})`;
      });
    },
    async prune() {
      // 只删除已确认投递的旧意图，未投递消息不因保留期而消失。
      await sql`delete from realtime_outbox where id in (select id from realtime_outbox
        where delivered_at<now()-interval '7 days' limit 1000)`;
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
export type RealtimeRepository = ReturnType<typeof openRealtimeRepository>;
