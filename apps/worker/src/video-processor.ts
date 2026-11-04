import { createHash } from "node:crypto";
import { videoInputSchema } from "@lycoboai/contracts";
import { type VideoRepository, videoCredentialHash } from "@lycoboai/db";
import { callVideoProvider, downloadProviderVideo, VideoProviderError } from "@lycoboai/generation";
import type { ImageObjectBucket } from "@lycoboai/storage/bucket";
import { isVideoReferenceUrl, providerReferenceSigner } from "@lycoboai/storage/delivery";
import { videoDimensions } from "@lycoboai/storage/video";
import { z } from "zod";

const claimed = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
  organizationId: z.uuid(),
  userId: z.uuid(),
  token: z.uuid(),
  input: videoInputSchema,
  origin: z.string(),
  credentialHash: z.string(),
  providerTaskId: z.string().nullable(),
  failures: z.number(),
  submit: z.boolean(),
  references: z.array(z.object({ id: z.uuid(), objectKey: z.string() })),
});
export type VideoWorkerConfig = {
  origin: string;
  key: string;
  assetOrigin: string;
  signingSecret: string;
  pathPrefix?: string | undefined;
  referenceUrl?: ((key: string) => Promise<string>) | undefined;
};
/** Each claim performs one submit, status read or original-file recovery, then persists progress. */
export async function processVideoIntent(
  repository: VideoRepository,
  bucket: ImageObjectBucket,
  config: VideoWorkerConfig,
  request: typeof fetch = fetch,
) {
  const raw = await repository.run("claim");
  if (!raw) return false;
  if (z.object({ skipped: z.literal(true) }).safeParse(raw).success) return true;
  const job = claimed.parse(raw);
  const finish = (status: string, errorCode?: string, asset?: Record<string, unknown>) =>
    repository.run("finish", { id: job.id, token: job.token, status, errorCode, asset });
  if (job.credentialHash !== videoCredentialHash(config.key) || job.origin !== config.origin) {
    await finish(job.submit ? "failed" : "needs_reconciliation", "VIDEO_CONFIGURATION_CHANGED");
    return true;
  }
  let taskId = job.providerTaskId;
  let sent = false;
  try {
    if (job.references.length !== job.input.referenceAssetIds.length)
      throw new VideoProviderError("REFERENCE_NOT_FOUND", false);
    const images: string[] = [];
    if (job.submit && job.references.length) {
      const sign =
        config.referenceUrl ??
        providerReferenceSigner(config.assetOrigin, config.signingSecret, config.pathPrefix);
      const signed = await Promise.all(job.references.map(({ objectKey }) => sign(objectKey)));
      await Promise.all(signed.map((url) => verifyReferenceImage(url, request)));
      images.push(...signed);
    }
    const creation = job.submit
      ? {
          input: job.input,
          images,
          key: job.itemId,
        }
      : undefined;
    sent = true;
    const task = await callVideoProvider(config, taskId ?? undefined, creation, request);
    if (taskId && task.id !== taskId) throw new VideoProviderError("VIDEO_TASK_MISMATCH");
    taskId = task.id;
    if (task.status === "failed" || task.status === "canceled") {
      await finish("failed", "VIDEO_PROVIDER_FAILED");
      return true;
    }
    // Persist the ID before downloading: a download crash must never lose a paid submission.
    if (job.submit || task.status !== "completed" || task.video_available === false) {
      await repository.run("defer", {
        id: job.id,
        token: job.token,
        providerTaskId: taskId,
        providerStatus: task.status,
        delaySeconds: Math.max(5, Math.ceil((task.poll_after_ms ?? 10000) / 1000)),
      });
      return true;
    }
    const bytes = await downloadProviderVideo(config, taskId, request);
    const dimensions = videoDimensions(bytes);
    const uidObject = job.references[0]?.objectKey.split("/")[0];
    // A text-only task resolves its UID through the injected worker storage callback below.
    const uid =
      uidObject ?? (await repositoryStorageUid(repository, job.organizationId, job.userId));
    const objectKey = `${uid}/${job.organizationId}/${job.itemId}.mp4`;
    await bucket.put(objectKey, bytes, { httpMetadata: { contentType: "video/mp4" } });
    await finish("succeeded", undefined, {
      objectKey,
      ...dimensions,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  } catch (error) {
    if (taskId && job.failures < 4) {
      await repository.run("defer", {
        id: job.id,
        token: job.token,
        providerTaskId: taskId,
        delaySeconds: Math.min(60, 10 * 2 ** job.failures),
        failure: true,
      });
    } else {
      const known = error instanceof VideoProviderError;
      await finish(
        !taskId && job.submit && (!sent || (known && !error.uncertain))
          ? "failed"
          : "needs_reconciliation",
        known ? error.code : "VIDEO_EXECUTION_UNAVAILABLE",
      );
    }
  }
  return true;
}
async function verifyReferenceImage(url: string, request: typeof fetch) {
  try {
    if (!isVideoReferenceUrl(url)) throw new Error("INVALID_REFERENCE_URL");
    const response = await request(url, {
      method: "GET",
      headers: { Range: "bytes=0-7" },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    const contentType = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
    await response.body?.cancel();
    if (response.ok && contentType === "image/png") return;
  } catch {
    // Signed URLs and upstream response details must never leave the worker.
  }
  throw new VideoProviderError("VIDEO_REFERENCES_UNAVAILABLE", false);
}

async function repositoryStorageUid(
  repository: VideoRepository,
  organizationId: string,
  userId: string,
) {
  return z
    .string()
    .regex(/^[0-9]{10}$/)
    .parse(await repository.run("storageUid", { organizationId, userId }));
}
