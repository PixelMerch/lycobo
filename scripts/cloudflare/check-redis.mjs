import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { startRedisBridge } from "./redis-dev.mjs";
import { openLocalQueue } from "./redis-queue.mjs";

if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
  throw new Error("Set ALLOW_LOCAL_INTEGRATION=true for the isolated Redis check.");
const redisUrl = process.env.LOCAL_REDIS_URL || "redis://127.0.0.1:56379";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(redisUrl).hostname))
  throw new Error("Integration checks require loopback Redis.");
const prefix = `lycobo:test:${randomUUID()}`;
const job = { version: 1, itemId: randomUUID() };
let queue;
let bridge;
let worker;
const cleanup = [];
try {
  queue = await openLocalQueue({ url: redisUrl, prefix, leaseMs: 30, maxAttempts: 2 });
  cleanup.push(queue.stream, queue.dead);
  await assert.rejects(queue.send({ ...job, prompt: "must-not-enter-redis" }));
  await queue.send(job);
  const first = await queue.next();
  assert.ok(first);
  // Simulate consumer death after delivery and before acknowledgement.
  await queue.close();
  await delay(50);
  queue = await openLocalQueue({ url: redisUrl, prefix, leaseMs: 30, maxAttempts: 2 });
  const recovered = await queue.next();
  assert.equal(recovered.id, first.id);
  assert.equal(await queue.deliver(recovered, async (data) => assert.deepEqual(data, job)), "ack");
  assert.equal(await queue.client.xLen(queue.stream), 0);

  await queue.send(job);
  assert.equal(
    await queue.deliver(await queue.next(), async () => {
      throw new Error("fixture failure");
    }),
    "retry",
  );
  await delay(50);
  assert.equal(
    await queue.deliver(await queue.next(), async () => {
      throw new Error("fixture failure");
    }),
    "dead",
  );
  const dead = await queue.client.xRange(queue.dead, "-", "+");
  assert.equal(dead.length, 1);
  assert.deepEqual(JSON.parse(dead[0].message.body), job);
  assert.equal(await queue.client.xLen(queue.stream), 0);

  // An active handler keeps its lease, so a second consumer cannot steal paid work.
  await queue.send(job);
  const active = await queue.next();
  const handler = queue.deliver(active, async () => {
    await delay(120);
  });
  const other = await openLocalQueue({ url: redisUrl, prefix, leaseMs: 30 });
  try {
    await delay(70);
    assert.equal(await other.next(), null);
  } finally {
    await other.close();
  }
  assert.equal(await handler, "ack");

  let calls = 0;
  const token = randomUUID();
  worker = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    if (request.url === "/__local/maintenance") {
      response.writeHead(204).end();
      return;
    }
    let text = "";
    for await (const chunk of request) text += chunk;
    assert.deepEqual(JSON.parse(text), job);
    calls++;
    response.writeHead(calls === 1 ? 503 : 204).end();
  });
  await new Promise((accept) => worker.listen(0, "127.0.0.1", accept));
  bridge = await startRedisBridge({
    redisUrl,
    token,
    port: 0,
    apiOrigin: `http://127.0.0.1:${worker.address().port}`,
    queueOptions: { prefix: `${prefix}:http`, leaseMs: 30 },
  });
  cleanup.push(bridge.queue.stream, bridge.queue.dead);
  const endpoint = `http://127.0.0.1:${bridge.server.address().port}`;
  assert.equal(
    (await fetch(`${endpoint}/enqueue`, { method: "POST", body: JSON.stringify(job) })).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${endpoint}/enqueue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...job, prompt: "rejected" }),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await fetch(`${endpoint}/enqueue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(job),
      })
    ).status,
    202,
  );
  for (
    let i = 0;
    i < 50 && (calls < 2 || (await bridge.queue.client.xLen(bridge.queue.stream)) > 0);
    i++
  )
    await delay(100);
  assert.equal(calls, 2);
  assert.equal(await bridge.queue.client.xLen(bridge.queue.stream), 0);
  console.info(
    "Local Redis: identifier-only messages, crash recovery, active leases, bounded retry/DLQ, authenticated HTTP delivery and acknowledgement passed (fixture only).",
  );
} finally {
  if (bridge) await bridge.close();
  if (worker) await new Promise((accept) => worker.close(accept));
  if (queue?.client.isOpen) {
    await queue.client.del(cleanup);
    await queue.close();
  }
}
