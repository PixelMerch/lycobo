import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  enterpriseLoginResponseSchema,
  imageJobSchema,
  unwrapApiData,
  walletBalanceSchema,
} from "@lycoboai/contracts";
import { openAuthRepository, openImageRepository } from "@lycoboai/db";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import postgres from "postgres";
import { z } from "zod";
import { hashPassword } from "../../api/src/features/auth/password";

/** Full Workers API -> real local Queue consumer -> R2 -> isolated PostgreSQL, provider fixture only. */
export async function verifyCloudflareApi() {
  if (process.env.ALLOW_LOCAL_INTEGRATION !== "true")
    throw new Error("Explicit isolated test opt-in required");
  const base = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
    !["postgres:", "postgresql:"].includes(base.protocol)
  )
    throw new Error("Only loopback PostgreSQL is allowed");
  const root = fileURLToPath(new URL("../../../", import.meta.url).href);
  const directory = await mkdtemp(path.join(tmpdir(), "lycobo-native-workers-"));
  const name = `cloudflare_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const admin = postgres(base.href, { max: 1 });
  const url = new URL(base);
  url.pathname = `/${name}`;
  let runtime: Miniflare | undefined;
  let images: ReturnType<typeof openImageRepository> | undefined;
  let auth: ReturnType<typeof openAuthRepository> | undefined;
  const db = postgres(url.href, { max: 1, connect_timeout: 5 });
  try {
    await admin.unsafe(`create database "${name}"`);
    const migrated = spawnSync("pnpm", ["db:migrate"], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url.href },
      stdio: "pipe",
    });
    assert.equal(migrated.status, 0, "Isolated Workers migration failed");
    for (const service of ["api", "worker"]) {
      const built = spawnSync(
        "pnpm",
        [
          "exec",
          "wrangler",
          "deploy",
          "--dry-run",
          "--config",
          `apps/${service}/wrangler.jsonc`,
          "--outdir",
          path.join(directory, service),
        ],
        { cwd: root, stdio: "pipe", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
      );
      assert.equal(built.status, 0, `Workers ${service} bundle failed`);
    }
    images = openImageRepository(url.href);
    auth = openAuthRepository(url.href);
    const principal = await images.provision(
      `native-fixture:${crypto.randomUUID()}`,
      "隔离测试工作空间",
      200,
    );
    const password = `fixture-${crypto.randomUUID()}`;
    await auth.setCredential(
      "native-fixture",
      principal.userId,
      principal.organizationId,
      await hashPassword(password),
    );
    const origin = "https://localhost";
    const fixturePng =
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=";
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        workers: [
          {
            name: "api",
            modules: true,
            compatibilityDate: "2026-10-23",
            compatibilityFlags: ["nodejs_compat"],
            script: await readFile(path.join(directory, "api/index.js"), "utf8"),
            hyperdrives: { HYPERDRIVE: url.href },
            r2Buckets: { IMAGES_BUCKET: "native-images" },
            images: { binding: "IMAGES" },
            queueProducers: { GENERATION_QUEUE: "native-generation" },
            bindings: {
              AUTH_JWT_SECRET: crypto.randomUUID() + crypto.randomUUID(),
              AUTH_TRUSTED_ORIGINS: origin,
              IMAGE_GENERATION_ENABLED: "true",
              VAKV_ENABLE_IMAGE_EDITS: "false",
            },
          },
          {
            name: "consumer",
            modules: true,
            compatibilityDate: "2026-10-23",
            compatibilityFlags: ["nodejs_compat"],
            script: await readFile(path.join(directory, "worker/index.js"), "utf8"),
            hyperdrives: { HYPERDRIVE: url.href },
            r2Buckets: { IMAGES_BUCKET: "native-images" },
            images: { binding: "IMAGES" },
            queueProducers: { GENERATION_QUEUE: "native-generation" },
            queueConsumers: {
              "native-generation": { maxBatchSize: 1, maxBatchTimeout: 0, maxRetries: 0 },
            },
            bindings: {
              IMAGE_GENERATION_ENABLED: "true",
              VAKV_API_KEY: "fixture-provider-key",
              VAKV_BASE_URL: "https://provider-fixture.example",
              GENERATION_TIMEOUT_MS: "10000",
            },
            outboundService: { name: "provider" },
          },
          {
            name: "provider",
            modules: true,
            compatibilityDate: "2026-10-23",
            script: `let calls=0;export default {async fetch(request){if(new URL(request.url).pathname==='/count')return Response.json({calls});calls++;return Response.json({data:[{b64_json:${JSON.stringify(fixturePng)}}]},{headers:{'x-request-id':'native-fixture'}})}}`,
          },
        ],
      }),
    );
    const worker = await runtime.getWorker("api");
    const cookie = new Map<string, string>();
    async function request(
      endpoint: string,
      init: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array } = {},
    ) {
      const response = await worker.fetch(`${origin}/api/v1${endpoint}`, {
        ...init,
        headers: {
          Origin: origin,
          "Sec-Fetch-Site": "same-origin",
          Cookie: [...cookie].map(([k, v]) => `${k}=${v}`).join("; "),
          ...init.headers,
        },
      });
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(";")[0] ?? "";
        const at = pair.indexOf("=");
        if (/Max-Age=0/i.test(raw)) cookie.delete(pair.slice(0, at));
        else cookie.set(pair.slice(0, at), pair.slice(at + 1));
      }
      return response;
    }
    const login = await request("/auth/enterprise/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "native-fixture", password }),
    });
    if (login.status !== 200) {
      const failure = await login.json();
      throw new Error(`Native login HTTP ${login.status}: ${JSON.stringify(failure)}`);
    }
    const loginBody = enterpriseLoginResponseSchema.parse(unwrapApiData(await login.json()));
    assert.equal(loginBody.user.uid, principal.uid);
    assert.ok(cookie.has("lycobo_enterprise_session"));
    assert.equal((await request("/auth/session")).status, 200);
    const uploaded = await request("/image-assets", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from(fixturePng, "base64"),
    });
    assert.equal(uploaded.status, 201);
    const assetBody = z.object({ id: z.uuid() }).parse(unwrapApiData(await uploaded.json()));
    const assetId = assetBody.id;
    const thumbnail = await request(`/image-assets/${assetId}/content?thumbnail=1`);
    assert.equal(thumbnail.status, 200);
    assert.ok((await thumbnail.arrayBuffer()).byteLength);
    const stream = await request("/image-events");
    assert.equal(stream.status, 200);
    const reader = stream.body?.getReader();
    assert.ok(reader);
    const firstEvent = await reader.read();
    assert.match(new TextDecoder().decode(firstEvent.value), /event: ready/);
    const created = await request("/image-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ model: "gpt-image-2", prompt: "isolated native fixture", count: 1 }),
    });
    assert.equal(created.status, 202);
    const createdBody = z.object({ id: z.uuid() }).parse(unwrapApiData(await created.json()));
    const jobId = createdBody.id;
    let job: z.infer<typeof imageJobSchema> | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await request(`/image-tasks/${jobId}`);
      assert.equal(response.status, 200);
      job = imageJobSchema.parse(unwrapApiData(await response.json()));
      if (job.status === "succeeded") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (job?.status !== "succeeded") {
      const stub = await runtime.getWorker("provider");
      console.info(
        "Fixture provider observation",
        await (await stub.fetch("http://localhost/count")).json(),
      );
    }
    assert.equal(
      job?.status,
      "succeeded",
      `Native execution failed: ${job?.items.map((item) => item.error_code).join(",")}`,
    );
    const [record] =
      await db`select a.object_key,i.attempts,i.id from generation_job_items i join media_assets a on a.id=i.output_asset_id where i.job_id=${jobId}`;
    assert.ok(record);
    assert.ok(String(record.object_key).startsWith(`${principal.uid}/`));
    assert.equal(record.attempts, 1);
    const bindings = await runtime.getBindings<{
      GENERATION_QUEUE: Queue<{ version: 1; itemId: string }>;
    }>("api");
    await bindings.GENERATION_QUEUE.send({ version: 1, itemId: String(record.id) });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const provider = await runtime.getWorker("provider");
    assert.deepEqual(
      await (await provider.fetch("https://provider-fixture.example/count")).json(),
      { calls: 1 },
    );
    const event = await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("Native SSE event timeout")), 6000).unref(),
      ),
    ]);
    assert.match(new TextDecoder().decode(event.value), /event: image.updated/);
    await reader.cancel();
    const wallet = walletBalanceSchema.parse(
      unwrapApiData(await (await request("/wallet")).json()),
    );
    assert.equal(wallet.balance, 180);
    assert.equal((await request("/auth/refresh", { method: "POST" })).status, 200);
    assert.equal((await request("/auth/logout", { method: "POST" })).status, 200);
    assert.equal((await request("/auth/session")).status, 401);
    console.info(
      "Native Workers API + Hyperdrive emulator + PostgreSQL + Queues consumer + R2/Images passed: scrypt login/cookies/refresh/logout, uploads/thumbnail, one paid-intent fixture execution, UID key, duplicate delivery and exactly one debit (no external provider)",
    );
  } finally {
    await runtime?.dispose();
    await images?.close();
    await auth?.close();
    await db.end({ timeout: 5 });
    await admin.unsafe(`drop database if exists "${name}"`);
    await admin.end({ timeout: 5 });
    await rm(directory, { recursive: true, force: true });
  }
}
