import assert from "node:assert/strict";
import {
  imageGenerationInputSchema,
  imageSubmissionResponseSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import type { ImageRepository } from "@lycoboai/db";
import { supportedResolutions, validateModelInput } from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type postgres from "postgres";
import { createApp } from "../../../api/src/app";
import { prepareReferences } from "../../src/cloudflare/cloudflare-consumer";
import { processImageItem } from "../../src/images/image-processor";

/** 不依赖浏览器等待，验证已接收上传可先建任务，图片未就绪时不领取或调用供应商。 */
export async function verifyReferenceWaiting(
  repository: ImageRepository,
  sql: postgres.Sql,
  store: ImageStore,
  png: Uint8Array,
) {
  const owner = await repository.provision(`waiting-${crypto.randomUUID()}`, "waiting-test", 20);
  const uploadId = crypto.randomUUID();
  const app = createApp(undefined, {
    repository,
    store,
    enabled: true,
    editsEnabled: true,
    unitCredits: 2,
    validate: (input) => validateModelInput(input, {}, true),
    resolutions: supportedResolutions,
    uploads: {
      enqueue: async () => uploadId,
      status: async (scope, id) =>
        scope.userId === owner.userId && id === uploadId ? { status: "pending" } : null,
    },
  });
  const input = imageGenerationInputSchema.parse({
    model: "gpt-image-2",
    prompt: "durable waiting",
    referenceAssetIds: [uploadId],
  });
  const headers = {
    Authorization: `Bearer ${owner.token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  };
  const response = await app.request("/api/v1/image-tasks", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  assert.equal(response.status, 202);
  const task = imageSubmissionResponseSchema.parse(unwrapApiData(await response.json()));
  const job = await repository.get(owner, task.id);
  const item = job?.items[0];
  assert.ok(item);
  const waiting = await repository.waitingReferenceUploads(item.id);
  assert.deepEqual(waiting?.ids, [uploadId]);
  const runtime = {
    repository,
    uploads: {
      status: async () => ({ status: "pending" as const }),
    },
  };
  await sql`update generation_jobs set created_at=now()-interval '21 minutes' where id=${task.id}`;
  assert.equal(await prepareReferences(item.id, runtime), "pending");
  let deferred = 0;
  await processImageItem(item.id, {
    repository,
    store,
    workerId: "waiting-fixture",
    overrides: {},
    editsEnabled: true,
    prepareReferences: (itemId) => prepareReferences(itemId, runtime),
    onDeferred: (ms) => {
      deferred = ms;
    },
  });
  assert.equal(deferred, 15000);
  assert.equal((await repository.get(owner, task.id))?.status, "queued");
  assert.equal((await repository.wallet(owner)).balance, 18);
  assert.equal(
    await prepareReferences(item.id, { repository, uploads: { status: async () => null } }),
    "failed",
  );
  await sql`update generation_jobs set created_at=now()-interval '31 minutes' where id=${task.id}`;
  assert.equal(await prepareReferences(item.id, runtime), "failed");
  const asset = await store.put(owner, png, uploadId);
  await repository.addReference(owner, asset);
  assert.equal(await repository.waitingReferenceUploads(item.id), null);
  assert.equal(await prepareReferences(item.id, runtime), "ready");
  const [stored] = await sql`select expires_at from media_assets where id=${uploadId}`;
  assert.equal(stored?.expires_at, null);
  const claimed = await repository.claim(item.id, "ready-fixture", 60000);
  assert.ok(claimed);
  await repository.finish(claimed, { errorCode: "FIXTURE_FINISH", unknown: false });
  assert.equal((await repository.wallet(owner)).balance, 20);
  await verifyFailedPreparation(repository, store, owner, input);
}

/** 准备失败在调用供应商之前结束，重复消费不能再次退款。 */
async function verifyFailedPreparation(
  repository: ImageRepository,
  store: ImageStore,
  owner: Awaited<ReturnType<ImageRepository["provision"]>>,
  input: ReturnType<typeof imageGenerationInputSchema.parse>,
) {
  const task = await repository.create(owner, input, crypto.randomUUID());
  const item = (await repository.get(owner, task.id))?.items[0];
  assert.ok(item);
  const deps = {
    repository,
    store,
    workerId: "failed-preparation-fixture",
    overrides: {},
    editsEnabled: true,
    prepareReferences: async (): Promise<"failed"> => "failed",
  };
  await processImageItem(item.id, deps);
  await processImageItem(item.id, deps);
  assert.equal((await repository.get(owner, task.id))?.status, "failed");
  assert.equal((await repository.wallet(owner)).balance, 20);
}
