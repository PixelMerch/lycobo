import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageJobSchema } from "@lycoboai/contracts";
import {
  openAuthRepository,
  openImageEventFeed,
  openImageRepository,
  recordImageEvent,
} from "@lycoboai/db";
import { imageStore } from "@lycoboai/storage";
import postgres from "postgres";
import { createApp } from "../src/app";
import { hashPassword } from "../src/features/auth/password";
import { enterpriseAuth } from "../src/features/auth/service";

if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
  throw new Error("Isolated test opt-in required");
const base = new URL(process.env.DATABASE_URL ?? "");
if (
  !["postgres:", "postgresql:"].includes(base.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
)
  throw new Error("Only loopback PostgreSQL allowed");
const name = `events_test_${crypto.randomUUID().replaceAll("-", "")}`;
const admin = postgres(base.href, { max: 1 });
const url = new URL(base);
url.pathname = `/${name}`;
const directory = await mkdtemp(path.join(tmpdir(), "lycobo-events-test-"));
let repository: ReturnType<typeof openImageRepository> | undefined;
let authDb: ReturnType<typeof openAuthRepository> | undefined;
let feed: ReturnType<typeof openImageEventFeed> | undefined;
let secondFeed: ReturnType<typeof openImageEventFeed> | undefined;
let sql: ReturnType<typeof postgres> | undefined;
const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];
function frames(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let buffer = "";
  const decoder = new TextDecoder();
  return async (wanted: string) => {
    const until = Date.now() + 7000;
    while (Date.now() < until) {
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const fields = Object.fromEntries(
          block
            .split("\n")
            .filter((line) => line.includes(":"))
            .map((line) => {
              const index = line.indexOf(":");
              return [line.slice(0, index), line.slice(index + 1).trimStart()];
            }),
        );
        if (fields.event === wanted) return fields;
        boundary = buffer.indexOf("\n\n");
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const next = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("EVENT_TIMEOUT")), until - Date.now());
        }),
      ]).finally(() => clearTimeout(timer));
      if (next.done) throw new Error("STREAM_CLOSED");
      buffer += decoder.decode(next.value, { stream: true });
    }
    throw new Error("EVENT_TIMEOUT");
  };
}
try {
  await admin.unsafe(`create database "${name}"`);
  const migrated = spawnSync("pnpm", ["--filter", "@lycoboai/db", "db:migrate"], {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    env: { ...process.env, DATABASE_URL: url.href },
    stdio: "pipe",
  });
  if (migrated.status !== 0) throw new Error("Isolated SSE migration failed");
  repository = openImageRepository(url.href);
  feed = openImageEventFeed(url.href);
  secondFeed = openImageEventFeed(url.href);
  sql = postgres(url.href, { max: 3 });
  const first = await repository.provision(`fixture:${crypto.randomUUID()}`, "events-one", 100);
  const other = await repository.provision(`fixture:${crypto.randomUUID()}`, "events-two", 100);
  const notifications: Array<string | null> = [];
  const stopSecond = await secondFeed.subscribe((organizationId) =>
    notifications.push(organizationId),
  );
  authDb = openAuthRepository(url.href);
  const origin = "http://localhost:5173";
  await authDb.setCredential(
    "events-fixture",
    first.userId,
    first.organizationId,
    await hashPassword("events-fixture-password"),
  );
  const auth = enterpriseAuth(authDb, {
    secret: crypto.randomUUID() + crypto.randomUUID(),
    origins: [origin],
    secureCookie: false,
  });
  const store = imageStore(directory);
  await store.ready();
  const app = createApp(
    undefined,
    {
      repository,
      auth,
      events: feed,
      store,
      enabled: true,
      unitCredits: 1,
      validate: () => {},
      resolutions: () => ["1K"],
    },
    auth,
  );
  const headers = { Authorization: `Bearer ${first.token}` };
  assert.equal((await app.request("/api/v1/image-events")).status, 401);
  assert.equal((await app.request("/api/v1/image-events?cursor=invalid", { headers })).status, 400);
  const response = await app.request("/api/v1/image-events", { headers });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  const reader = response.body?.getReader();
  assert.ok(reader);
  readers.push(reader);
  const next = frames(reader);
  await next("ready");
  const input = {
    model: "gpt-image-2" as const,
    prompt: "isolated event fixture",
    resolution: "1K" as const,
    aspectRatio: "1:1" as const,
    count: 1,
    referenceAssetIds: [],
  };
  await repository.create(other, input, crypto.randomUUID(), 1);
  assert.deepEqual(await feed.since(first, "0"), []);
  const job = await repository.create(first, input, crypto.randomUUID(), 1);
  const created = await next("image.updated");
  assert.equal(JSON.parse(created.data ?? "{}").resourceId, job.id);
  const cursor = created.id ?? "0";
  const beforeRollback = await feed.latest(first);
  try {
    await sql.begin(async (tx) => {
      await recordImageEvent(tx, first.organizationId, "task", crypto.randomUUID());
      throw new Error("ROLLBACK_FIXTURE");
    });
  } catch (error) {
    assert.equal(error instanceof Error && error.message, "ROLLBACK_FIXTURE");
  }
  assert.equal(await feed.latest(first), beforeRollback);
  await reader.cancel();
  const details = imageJobSchema.parse(
    JSON.parse(JSON.stringify(await repository.get(first, job.id))),
  );
  const itemId = details.items[0]?.id;
  assert.ok(itemId);
  const claimed = await repository.claim(itemId, "event-fixture-worker", 30000);
  assert.ok(claimed);
  assert.equal(
    await repository.finish(claimed, { errorCode: "FIXTURE_FAILURE", unknown: false }),
    true,
  );
  const replay = await app.request("/api/v1/image-events", {
    headers: { ...headers, "Last-Event-ID": cursor },
  });
  const replayReader = replay.body?.getReader();
  assert.ok(replayReader);
  readers.push(replayReader);
  const replayNext = frames(replayReader);
  const event = await replayNext("image.updated");
  assert.ok(BigInt(event.id ?? "0") > BigInt(cursor));
  assert.equal(JSON.parse(event.data ?? "{}").resourceId, job.id);
  await replayNext("ready");
  assert.equal((await repository.get(first, job.id))?.status, "failed");
  assert.equal((await secondFeed.since(first, cursor)).length, 2);
  assert.ok(notifications.includes(first.organizationId));
  const all = await feed.since(first, "0");
  assert.equal(new Set(all.map((entry) => entry.id)).size, all.length);
  assert.ok(all.every((entry) => entry.resourceId === job.id));
  const loginResponse = await app.request("/api/v1/auth/enterprise/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ account: "events-fixture", password: "events-fixture-password" }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers
    .getSetCookie()
    .find((value) => value.startsWith("lycobo_enterprise_session="))
    ?.split(";")[0];
  assert.ok(cookie);
  assert.equal(
    (
      await app.request("/api/v1/image-events", {
        headers: { Cookie: cookie, "Sec-Fetch-Site": "cross-site" },
      })
    ).status,
    401,
  );
  const cookieResponse = await app.request("/api/v1/image-events", {
    headers: { Cookie: cookie, "Sec-Fetch-Site": "same-origin" },
  });
  assert.equal(cookieResponse.status, 200);
  const cookieReader = cookieResponse.body?.getReader();
  assert.ok(cookieReader);
  readers.push(cookieReader);
  const cookieNext = frames(cookieReader);
  await cookieNext("ready");
  await authDb.setCredential(
    "events-fixture",
    first.userId,
    first.organizationId,
    await hashPassword("events-replaced-password"),
  );
  await repository.create(first, input, crypto.randomUUID(), 1);
  await cookieNext("auth-expired");
  await cookieReader.cancel();
  // Revocation is checked again before events are written, not just at connection setup.
  await sql`update generation_api_keys set revoked_at=now() where id=${first.keyId}`;
  await repository.create(first, input, crypto.randomUUID(), 1);
  await replayNext("auth-expired");
  await replayReader.cancel();
  stopSecond();
  // Distinct database connections/API processes see the same durable cursor and notifications.
  console.info(
    "SSE integration passed: isolated migrations, tenant isolation, committed notifications, rollback, task lifecycle, reconnect/replay, cursor ordering and revoked-session rejection (fixture only)",
  );
} finally {
  await Promise.allSettled(readers.map((reader) => reader.cancel()));
  await Promise.all([
    feed?.close(),
    secondFeed?.close(),
    repository?.close(),
    authDb?.close(),
    sql?.end({ timeout: 5 }),
  ]);
  await admin.unsafe(`drop database if exists "${name}"`);
  await admin.end({ timeout: 5 });
  await rm(directory, { recursive: true, force: true });
}
