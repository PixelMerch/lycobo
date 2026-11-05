import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ImageGenerationInput, ImageScope } from "@lycoboai/contracts";
import { videoInputSchema } from "@lycoboai/contracts";
import {
  type CloudBaseRpc,
  cloudbaseImageRepository,
  type openImageRepository,
  videoCredentialHash,
  videoRepository,
} from "@lycoboai/db";
import { standaloneModels } from "@lycoboai/generation";
import type postgres from "postgres";
import { z } from "zod";

export async function verifyCloudbaseWebhooks(
  call: CloudBaseRpc,
  sql: postgres.Sql,
  native: ReturnType<typeof openImageRepository>,
  scope: ImageScope,
  stranger: ImageScope,
  input: ImageGenerationInput,
) {
  const webhookConfig = await standaloneModels({
    STANDALONE_MODELS: "true",
    STANDALONE_IMAGE_API_KEY: "fixture-only",
    DEEPSEEK_API_KEY: "fixture-only",
    IMAGE_WEBHOOK_ENABLED: "true",
  });
  if (!webhookConfig) throw new Error("Missing webhook config");
  const webhooks = cloudbaseImageRepository(call, webhookConfig);
  const webhookJob = await webhooks.create(scope, { ...input, count: 1 }, randomUUID());
  const [webhookItem] =
    await sql`select id from generation_job_items where job_id=${webhookJob.id}`;
  const webhookClaim = await webhooks.claim(webhookItem?.id, "webhook-fixture", 90000);
  if (!webhookClaim?.configuredProvider?.snapshot.webhook) throw new Error("Missing webhook claim");
  const receipt = {
    source: webhookClaim.configuredProvider.snapshot.webhook.source,
    eventId: "evt_early",
    taskId: "imgtask_early",
    eventType: "image.task.completed" as const,
    taskStatus: "success" as const,
  };
  const balance = (await webhooks.wallet(scope)).balance;
  assert.equal(await webhooks.webhookReceive(receipt), false);
  assert.equal(
    await webhooks.webhookWait(webhookClaim, receipt.taskId, "/v1/images/tasks/imgtask_early"),
    true,
  );
  assert.equal(await webhooks.webhookReceive(receipt), true);
  assert.equal((await webhooks.wallet(scope)).balance, balance);
  assert.equal(
    (await sql`select count(*)::int n from provider_webhook_events where event_id='evt_early'`)[0]
      ?.n,
    1,
  );
  await assert.rejects(webhooks.webhookReceive({ ...receipt, taskStatus: "uncertain" }), {
    message: "IDEMPOTENCY_CONFLICT",
  });
  assert.equal(await webhooks.webhookReceive({ ...receipt, source: "b".repeat(64) }), false);
  assert.equal((await webhooks.getMany(stranger, [webhookJob.id])).length, 0);
  assert.equal((await webhooks.getMany(scope, [webhookJob.id]))[0]?.recovery_due, true);
  await sql`update generation_job_items set started_at=now()-interval '4 hours',lease_expires_at=now()-interval '3 hours' where id=${webhookClaim.itemId}`;
  await sql`update provider_executions set deadline_at=now()-interval '3 hours' where item_id=${webhookClaim.itemId}`;
  await webhooks.expireClaims();
  assert.equal((await webhooks.getMany(scope, [webhookJob.id]))[0]?.status, "running");
  assert.equal((await native.getMany(scope, [webhookJob.id]))[0]?.status, "running");
  assert.equal((await native.getMany(stranger, [webhookJob.id])).length, 0);
  const lateClaim = await webhooks.claim(webhookClaim.itemId, "late-webhook", 90000);
  assert(lateClaim);
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_during_lease" }), false);
  assert.equal(
    await webhooks.webhookWait(lateClaim, receipt.taskId, "/v1/images/tasks/imgtask_early"),
    true,
  );
  const finalClaim = await webhooks.claim(webhookClaim.itemId, "final-webhook", 90000);
  assert(finalClaim);
  await webhooks.finish(finalClaim, { errorCode: "PROVIDER_OUTCOME_UNKNOWN", unknown: true });
  assert.equal((await webhooks.wallet(scope)).balance, balance);
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_late_recovery" }), true);
  const recoveredClaim = await webhooks.claim(webhookClaim.itemId, "recovered-webhook", 90000);
  assert(recoveredClaim);
  await webhooks.finish(recoveredClaim, { errorCode: "PROVIDER_TASK_FAILED", unknown: false });
  const finalBalance = (await webhooks.wallet(scope)).balance;
  assert.equal(finalBalance, balance + 2);
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_after_finished" }), false);
  assert.equal((await webhooks.wallet(scope)).balance, finalBalance);
  await webhooks.retry(scope, webhookJob.id, randomUUID(), webhookClaim.itemId, true);
  const retryBalance = (await webhooks.wallet(scope)).balance;
  assert.equal(await webhooks.webhookReceive({ ...receipt, eventId: "evt_superseded" }), false);
  assert.equal((await webhooks.wallet(scope)).balance, retryBalance);
  await webhooks.pruneWebhooks();
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select public.lycobo_provider_webhook('prune','{}'::jsonb)`;
      }),
      { code: "42501" },
    );
  }
}

export async function verifyCloudbaseVideos(
  call: CloudBaseRpc,
  sql: postgres.Sql,
  native: ReturnType<typeof openImageRepository>,
  repository: ReturnType<typeof cloudbaseImageRepository>,
) {
  const videoOwner = await native.provision(`rpc-video:${randomUUID()}`, "video RPC fixture", 100);
  const videos = videoRepository((p_operation, p_args = {}) =>
    call("lycobo_video_operation", { p_operation, p_args }),
  );
  const videoInput = videoInputSchema.parse({ prompt: "隔离视频RPC fixture", seconds: 10 });
  const video = await videos.create(videoOwner, videoInput, randomUUID(), {
    origin: "https://api.uselg.top",
    credentialHash: videoCredentialHash("fixture-only"),
  });
  assert.equal((await repository.wallet(videoOwner)).balance, 0);
  assert.equal(
    (await repository.list(videoOwner, 100)).length,
    0,
    "Image history must exclude video tasks",
  );
  const videoClaim = z
    .object({ id: z.string(), itemId: z.string(), token: z.string() })
    .parse(await videos.run("claim"));
  assert.equal(videoClaim.id, video.id);
  await videos.run("finish", {
    id: video.id,
    token: videoClaim.token,
    status: "succeeded",
    asset: {
      objectKey: `${videoOwner.uid}/${videoOwner.organizationId}/${videoClaim.itemId}.mp4`,
      width: 512,
      height: 768,
      bytes: 100,
      sha256: "0".repeat(64),
    },
  });
  const videoAssets = await repository.listAssets(videoOwner, 100, undefined, "output", "video", {
    tool: "video",
    includeVideo: true,
  });
  assert.equal(videoAssets.length, 1);
  assert.equal(videoAssets[0]?.duration_seconds, 10);
  assert.equal(videoAssets[0]?.resolution, "768p");
  assert.equal(
    (await repository.listAssets(videoOwner, 100)).length,
    0,
    "Legacy list requests must not receive video tool DTOs",
  );
  for (const role of ["anon", "authenticated"]) {
    await assert.rejects(
      sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select public.lycobo_video_operation('claim','{}'::jsonb)`;
      }),
      { code: "42501" },
    );
  }
  console.log(
    "CloudBase video RPC: 100-credit submission, video asset opt-in, image history exclusion and client-role denial passed (local fixtures only)",
  );
}

export async function verifyCloudbaseOptimizer(
  sql: postgres.Sql,
  native: ReturnType<typeof openImageRepository>,
  repository: ReturnType<typeof cloudbaseImageRepository>,
  stranger: ImageScope,
) {
  const optimizerScope = await native.provision(
    `prompt-optimizer:${randomUUID()}`,
    "Optimizer fixture",
    3,
  );
  const attemptKey = randomUUID();
  const hashes = await Promise.all([
    native.promptOptimization.begin(optimizerScope, attemptKey, "same"),
    repository.promptOptimization.begin(optimizerScope, attemptKey, "same"),
  ]);
  assert.deepEqual(hashes.map(({ status }) => status).sort(), ["running", "started"]);
  assert.equal((await repository.wallet(optimizerScope)).balance, 2);
  assert.equal(
    (await repository.promptOptimization.begin(stranger, attemptKey, "same")).status,
    "insufficient",
  );
  await assert.rejects(
    repository.promptOptimization.begin(optimizerScope, attemptKey, "different"),
    {
      code: "IDEMPOTENCY_CONFLICT",
    },
  );
  const result = "把床品铺在原木床上，使用侧光表现面料纹理。";
  assert.equal(
    (await repository.promptOptimization.finish(optimizerScope, attemptKey, result)).status,
    "ready",
  );
  assert.deepEqual(await native.promptOptimization.begin(optimizerScope, attemptKey, "same"), {
    status: "ready",
    result,
  });
  const failedKey = randomUUID();
  await repository.promptOptimization.begin(optimizerScope, failedKey, "failure");
  await Promise.all([
    native.promptOptimization.finish(optimizerScope, failedKey, null),
    repository.promptOptimization.finish(optimizerScope, failedKey, null),
  ]);
  assert.equal((await repository.wallet(optimizerScope)).balance, 2);
  assert.equal(
    (await native.promptOptimization.finish(optimizerScope, failedKey, result)).status,
    "failed",
  );
  for (const role of ["anon", "authenticated", "service_role"]) {
    const [grant] =
      await sql`select has_table_privilege(${role}, 'public.prompt_optimizations', 'SELECT,INSERT,UPDATE,DELETE') as direct_access,
      has_function_privilege(${role}, 'public.lycobo_prompt_optimization(text,jsonb)', 'EXECUTE') as rpc_access`;
    assert.equal(grant?.direct_access, false);
    assert.equal(grant?.rpc_access, role === "service_role");
  }
}
