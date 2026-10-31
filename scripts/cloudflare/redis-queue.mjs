import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { imageQueueJobSchema } from "../../packages/queue/src/index.ts";

/** Redis is local transport only. DB claims still guard paid execution and uncertain outcomes. */
export async function openLocalQueue({
  url,
  prefix = "lycobo:local",
  leaseMs = 30000,
  maxAttempts = 4,
}) {
  const target = new URL(url);
  if (
    target.protocol !== "redis:" ||
    !["redis", "localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
  )
    throw new Error("LOCAL_REDIS_REQUIRED");
  const client = createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: 5000 } });
  client.on("error", () => console.error("LOCAL_REDIS_UNAVAILABLE"));
  await client.connect();
  const stream = `${prefix}:generation`;
  const dead = `${prefix}:dead`;
  const group = "generation";
  const consumer = randomUUID();
  try {
    await client.xGroupCreate(stream, group, "0", { MKSTREAM: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("BUSYGROUP")) {
      await client.close();
      throw error;
    }
  }
  const acknowledge = (id) => client.multi().xAck(stream, group, id).xDel(stream, id).exec();
  return {
    client,
    stream,
    dead,
    group,
    ping: () => client.ping(),
    close: () => client.close(),
    send: async (job) =>
      client.xAdd(stream, "*", { body: JSON.stringify(imageQueueJobSchema.parse(job)) }),
    async next() {
      const pending = await client.xAutoClaim(stream, group, consumer, leaseMs, "0-0", {
        COUNT: 1,
      });
      if (pending.messages[0]) return pending.messages[0];
      const fresh = await client.xReadGroup(group, consumer, [{ key: stream, id: ">" }], {
        COUNT: 1,
      });
      return fresh?.[0]?.messages[0] ?? null;
    },
    async deliver(message, handle) {
      const pending = await client.xPendingRange(stream, group, message.id, message.id, 1);
      const attempts = pending[0]?.deliveriesCounter ?? 1;
      let job;
      try {
        job = imageQueueJobSchema.parse(JSON.parse(message.message.body));
      } catch {
        // Invalid data is discarded without copying potentially private contents to the DLQ.
        await acknowledge(message.id);
        return "invalid";
      }
      const heartbeat = setInterval(
        () => {
          void client
            .xClaimJustId(stream, group, consumer, 0, message.id)
            .catch(() => console.error("LOCAL_REDIS_LEASE_UNAVAILABLE"));
        },
        Math.max(10, Math.floor(leaseMs / 3)),
      );
      try {
        await handle(job, message.id);
        await acknowledge(message.id);
        return "ack";
      } catch {
        if (attempts >= maxAttempts) {
          await client
            .multi()
            .xAdd(
              dead,
              "*",
              { body: JSON.stringify(job) },
              { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 1000 } },
            )
            .xAck(stream, group, message.id)
            .xDel(stream, message.id)
            .exec();
          return "dead";
        }
        return "retry";
      } finally {
        clearInterval(heartbeat);
      }
    },
  };
}
