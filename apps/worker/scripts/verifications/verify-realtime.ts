import assert from "node:assert/strict";
import { imageGenerationInputSchema } from "@lycoboai/contracts";
import { type ImageRepository, openRealtimeRepository } from "@lycoboai/db";
import type postgres from "postgres";

/** 在独立测试库验证事务事件、积分通知、离线消息与用户已读隔离。 */
export async function verifyRealtime(url: string, images: ImageRepository, sql: postgres.Sql) {
  const first = await images.provision(`rt:${crypto.randomUUID()}`, "realtime-fixture", 100);
  const second = await images.provision(`rt-other:${crypto.randomUUID()}`, "realtime-other", 100);
  const repository = openRealtimeRepository(url);
  try {
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx`insert into realtime_notifications(organization_id,title,body) values (${first.organizationId},'rollback','fixture')`;
        throw new Error("ROLLBACK_FIXTURE");
      }),
    );
    const rolled =
      await sql`select id from realtime_notifications where organization_id=${first.organizationId}`;
    assert.equal(rolled.length, 0);
    const [notification] =
      await sql`insert into realtime_notifications(organization_id,user_id,title,body)
      values (${first.organizationId},${first.userId},'fixture','fixture') returning id`;
    assert.ok(notification);
    const id = String(notification.id);
    assert.equal((await repository.notifications(first)).unread, 1);
    assert.equal((await repository.notifications(second)).unread, 0);
    await repository.read(second, id);
    assert.equal((await repository.notifications(first)).unread, 1);
    await repository.read(first, id);
    await repository.read(first, id);
    assert.equal((await repository.notifications(first)).unread, 0);
    const input = imageGenerationInputSchema.parse({
      model: "gpt-image-2",
      prompt: "realtime-fixture",
    });
    const job = await images.create(first, input, crypto.randomUUID());
    const pending =
      await sql`select event->>'kind' as kind from realtime_outbox where channel=${first.organizationId}`;
    assert.ok(pending.some((row) => row.kind === "wallet"));
    assert.ok(pending.some((row) => row.kind === "task"));
    assert.ok(pending.some((row) => row.kind === "notification"));
    await sql`update generation_jobs set status='succeeded' where id=${job.id}`;
    await sql`update generation_jobs set status='succeeded' where id=${job.id}`;
    assert.equal(
      (await repository.notifications(first)).data.filter((n) => n.title === "图片生成完成").length,
      1,
    );
    await sql`insert into realtime_notifications(organization_id,title,body)
      select ${first.organizationId},'分页消息 '||number,'fixture' from generate_series(1,103) number`;
    const page = await repository.notifications(first);
    assert.equal(page.data.length, 100);
    assert.ok(page.nextCursor);
    const rest = await repository.notifications(first, page.nextCursor);
    assert.equal(rest.data.length, 5);
    assert.equal(rest.nextCursor, null);
    assert.equal(new Set([...page.data, ...rest.data].map((row) => row.id)).size, 105);
    const events = await repository.pending();
    assert.ok(events.length);
    const confirmed = events.slice(0, 2);
    const unconfirmedEvent = events[2];
    assert.ok(unconfirmedEvent);
    await repository.delivered(confirmed.map((event) => event.id));
    await repository.delivered([]);
    const remaining = await repository.pending();
    assert.ok(confirmed.every((event) => !remaining.some((row) => row.id === event.id)));
    assert.ok(remaining.some((row) => row.id === unconfirmedEvent.id));
  } finally {
    await repository.close();
  }
}
