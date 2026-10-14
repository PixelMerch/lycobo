import assert from "node:assert/strict";
import { openDatabase } from "@lycoboai/db";
import { redisConnection } from "@lycoboai/queue";
import { Queue, QueueEvents, Worker } from "bullmq";
import postgres from "postgres";
import { processDiagnostic } from "../src/processor";

function localUrl(value: string | undefined, protocols: string[]) {
  if (!value) throw new Error("Explicit local test URLs are required");
  const url = new URL(value);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !protocols.includes(url.protocol)
  ) {
    throw new Error("Integration tests only accept loopback services");
  }
  return value;
}
if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
  throw new Error("Set ALLOW_LOCAL_INTEGRATION=true to run isolated integration checks");
const databaseUrl = localUrl(process.env.DATABASE_URL, ["postgres:", "postgresql:"]);
const redisUrl = localUrl(process.env.REDIS_URL, ["redis:", "rediss:"]);
const runId = crypto.randomUUID();
const ownerId = crypto.randomUUID();
const otherOwnerId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const taskId = crypto.randomUUID();
const idempotencyKey = crypto.randomUUID();
const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
const connection = openDatabase(databaseUrl);
try {
  await connection.db.execute("select 1");
  await client`insert into users (id, auth_subject) values (${ownerId}, ${`integration-${runId}`}), (${otherOwnerId}, ${`integration-other-${runId}`})`;
  await client`insert into projects (id, owner_id, name) values (${projectId}, ${ownerId}, ${`integration-${runId}`})`;
  await client`insert into tasks (id, owner_id, project_id, idempotency_key, input_hash, input, requested_count) values (${taskId}, ${ownerId}, ${projectId}, ${idempotencyKey}, 'test-hash', '{}', 2)`;
  await assert.rejects(
    client`insert into tasks (owner_id, project_id, idempotency_key, input_hash, input, requested_count) values (${ownerId}, ${projectId}, ${idempotencyKey}, 'test-hash', '{}', 2)`,
    /unique constraint/,
  );
  await assert.rejects(
    client`insert into tasks (owner_id, project_id, idempotency_key, input_hash, input, requested_count) values (${otherOwnerId}, ${projectId}, ${crypto.randomUUID()}, 'test-hash', '{}', 2)`,
    /foreign key constraint/,
  );
  await assert.rejects(
    client`insert into task_items (task_id, position, status) values (${taskId}, 0, 'succeeded')`,
    /check constraint/,
  );
  // A provider batch may legitimately return several result items with the same remote task ID.
  await client`insert into task_items (task_id, position, provider, provider_task_id) values (${taskId}, 0, 'integration', ${runId}), (${taskId}, 1, 'integration', ${runId})`;
  await client`insert into notifications (owner_id, task_id, event_key) values (${ownerId}, ${taskId}, ${runId})`;
  const [notification] = await client`select read_at from notifications where task_id = ${taskId}`;
  assert.equal(notification?.read_at, null);
  console.info("Database constraints and unread persistence passed");
} finally {
  try {
    await client`delete from notifications where task_id = ${taskId}`;
    await client`delete from task_items where task_id = ${taskId}`;
    await client`delete from tasks where project_id = ${projectId}`;
    await client`delete from projects where id = ${projectId}`;
    await client`delete from users where id in (${ownerId}, ${otherOwnerId})`;
    const [remaining] =
      await client`select count(*)::int as count from users where id in (${ownerId}, ${otherOwnerId})`;
    assert.equal(remaining?.count, 0);
  } finally {
    await client.end({ timeout: 5 });
    await connection.close();
  }
}

const queueName = `lycoboai-integration-${runId}`;
const config = redisConnection(redisUrl);
const queue = new Queue(queueName, { connection: config });
const events = new QueueEvents(queueName, { connection: config });
const worker = new Worker(queueName, async (job) => processDiagnostic(job.name, job.data), {
  connection: config,
});
try {
  await events.waitUntilReady();
  await worker.waitUntilReady();
  const job = await queue.add("healthcheck", { runId });
  assert.deepEqual(await job.waitUntilFinished(events, 10_000), { runId, status: "ok" });
  console.info("Real Redis queue / Worker roundtrip passed");
} finally {
  await worker.close();
  await events.close();
  await queue.obliterate({ force: true }); // Only this run's UUID-named test queue.
  assert.equal(await queue.getJobCountByTypes("completed", "failed", "wait", "active"), 0);
  await queue.close();
}
