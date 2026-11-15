import { imageOutputDimensions, providerModelForResolution } from "@lycoboai/contracts";
import type { ClaimedImage, ImageRuntimeRepository } from "@lycoboai/db";
import {
  configuredProviderCall,
  type GenerationTiming,
  ImageProviderError,
  openProviderKey,
  ProviderPollError,
  type ProviderResult,
  providerOutputBytes,
  reportGenerationTiming,
  standaloneCredentialId,
  textileItemInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type { DeliverProviderReference } from "./provider-references";
import {
  mainImageHasReferences,
  mapProviderReferences,
  readProviderReferences,
} from "./provider-references";

type ConfiguredImageDependencies = {
  repository: Pick<
    ImageRuntimeRepository,
    "providerCipher" | "asset" | "deferProvider" | "finish" | "webhookWait"
  >;
  store: Pick<ImageStore, "read" | "put">;
  modelSecret?: string | undefined;
  standaloneKey?: string | undefined;
  request?: typeof fetch;
  deliverReference?: DeliverProviderReference;
  requireMainImageReferenceUrls?: boolean;
  onDeferred?: ((delayMs: number) => void) | undefined;
  onWebhookAccepted?: ((ready: boolean) => void) | undefined;
  onTiming?: ((event: GenerationTiming & { itemId: string }) => void) | undefined;
};

type ConfiguredProvider = NonNullable<ClaimedImage["configuredProvider"]>;

async function configuredReferences(
  job: ClaimedImage,
  snapshot: ConfiguredProvider["snapshot"],
  deps: ConfiguredImageDependencies,
): Promise<{ bytes: Uint8Array[]; urls?: URL[] }> {
  const deliver = deps.deliverReference;
  const fixedFluxPort =
    snapshot.credentialId === standaloneCredentialId &&
    new URL(snapshot.origin).origin === "https://api.ai-media.vip";
  if (deps.requireMainImageReferenceUrls && mainImageHasReferences(job.input)) {
    if (!deliver || !fixedFluxPort || snapshot.adapter === "openai-images")
      throw new ImageProviderError("PROVIDER_REFERENCE_URL_REQUIRED", false);
    return { bytes: [], urls: await requiredReferenceUrls(job, deps.repository, deliver) };
  }
  const providerModel = providerModelForResolution(snapshot, job.input.resolution);
  const usesSunburst =
    providerModel === "gpt-image-2.5-sunburst" || providerModel === "gpt-image-2.6-sunburst";
  if (deliver && fixedFluxPort && snapshot.adapter === "fluxport-images" && usesSunburst) {
    try {
      const urls = await mapProviderReferences(job, deps.repository, (asset) =>
        deliver(asset, !!job.input.localEdit),
      );
      return { bytes: [], urls };
    } catch {
      // 尚未发出付费请求，同一次尝试仍可改用内嵌图片。
    }
  }
  return { bytes: await readProviderReferences(job, deps.repository, deps.store) };
}

async function requiredReferenceUrls(
  job: ClaimedImage,
  repository: ConfiguredImageDependencies["repository"],
  deliver: DeliverProviderReference,
) {
  try {
    return await mapProviderReferences(job, repository, (asset) => deliver(asset, false));
  } catch (error) {
    if (error instanceof ImageProviderError) throw error;
    throw new ImageProviderError("REFERENCE_STORAGE_UNAVAILABLE", false);
  }
}

async function readCredential(deps: ConfiguredImageDependencies, credentialId: string) {
  if (credentialId === standaloneCredentialId) return deps.standaloneKey;
  if (!deps.modelSecret) return undefined;
  return openProviderKey(await deps.repository.providerCipher(credentialId), deps.modelSecret);
}

async function deferPendingImage(
  job: ClaimedImage,
  deps: ConfiguredImageDependencies,
  state: ConfiguredProvider,
  result: Extract<ProviderResult, { kind: "pending" }>,
) {
  if (Date.now() > state.deadlineAt.getTime())
    throw new ImageProviderError("PROVIDER_TASK_DEADLINE", true);
  if (state.snapshot.webhook) {
    const ready = await deps.repository.webhookWait(
      job,
      result.taskId,
      result.statusPath,
      result.requestId,
    );
    deps.onWebhookAccepted?.(ready);
    return;
  }
  await deps.repository.deferProvider(
    job,
    result.taskId,
    result.statusPath,
    result.delayMs,
    false,
    result.requestId,
  );
  deps.onDeferred?.(result.delayMs);
  return;
}

function stopsPolling(error: unknown) {
  return (
    error instanceof ImageProviderError &&
    [
      "PROVIDER_TASK_FAILED",
      "PROVIDER_POLL_STOPPED",
      "PROVIDER_OUTCOME_UNKNOWN",
      "PROVIDER_UNTRUSTED_TASK_URL",
      "PROVIDER_UNTRUSTED_RESULT_URL",
    ].includes(error.code)
  );
}

async function settleConfiguredFailure(
  job: ClaimedImage,
  deps: ConfiguredImageDependencies,
  state: ConfiguredProvider,
  poll: { taskId: string; statusPath: string } | undefined,
  sent: boolean,
  error: unknown,
) {
  const known = error instanceof ImageProviderError;
  if (poll && Date.now() < state.deadlineAt.getTime() && !stopsPolling(error)) {
    // 已有供应商任务号，核查期限内只重试读取，指数退避最多增长到一分钟。
    const delayMs = Math.min(
      60000,
      Math.max(
        5000 * 2 ** Math.min(state.pollFailures, 4),
        error instanceof ProviderPollError ? error.delayMs : 0,
      ),
    );
    await deps.repository.deferProvider(job, poll.taskId, poll.statusPath, delayMs, true);
    deps.onDeferred?.(delayMs);
    return;
  }
  await deps.repository.finish(job, {
    errorCode: known ? error.code : "CONFIGURED_PROVIDER_UNAVAILABLE",
    requestId: known ? error.requestId : undefined,
    unknown: (Boolean(poll) || sent) && (!known || error.unknownOutcome),
  });
}

/** 执行配置渠道的提交或结果读取，读取失败时只重查原任务。 */
export async function processConfiguredImage(job: ClaimedImage, deps: ConfiguredImageDependencies) {
  const state = job.configuredProvider;
  if (!state) throw new Error("PROVIDER_SNAPSHOT_REQUIRED");
  const poll =
    state.phase === "polling" && state.taskId && state.statusPath
      ? { taskId: state.taskId, statusPath: state.statusPath }
      : undefined;
  const report = (event: GenerationTiming) =>
    reportGenerationTiming((timing) => deps.onTiming?.({ ...timing, itemId: job.itemId }), event);
  const time = async <T>(stage: string, operation: () => Promise<T>) => {
    const started = performance.now();
    try {
      return await operation();
    } catch (error) {
      if (stage === "image_storage") {
        // Cloudflare 数字错误码不包含图片内容或供应商地址。
        const serviceCode =
          error instanceof Error && "code" in error && typeof error.code === "number"
            ? error.code
            : undefined;
        console.warn({ event: "IMAGE_STORAGE_FAILED", itemId: job.itemId, serviceCode });
      }
      throw error;
    } finally {
      report({ stage, durationMs: Math.round(performance.now() - started) });
    }
  };
  let sent = false;
  try {
    if (Date.now() > state.deadlineAt.getTime() && !(poll && state.snapshot.webhook))
      throw new ImageProviderError("PROVIDER_TASK_DEADLINE", true);
    const key = await readCredential(deps, state.snapshot.credentialId);
    if (!key) throw new ImageProviderError("MODEL_SECRET_NOT_CONFIGURED", !!poll);
    const references = poll
      ? { bytes: [] }
      : await time("reference_prepare", () => configuredReferences(job, state.snapshot, deps));
    sent = true;
    const result = await time(poll ? "provider_result_lookup" : "provider_submit", () =>
      configuredProviderCall(
        state.snapshot,
        key,
        textileItemInput(job.input, job.position),
        references.bytes,
        job.itemId,
        poll,
        deps.request,
        references.urls,
      ),
    );
    if (result.kind === "pending") {
      return await time("provider_receipt", () => deferPendingImage(job, deps, state, result));
    }
    // 每个扣费项交付供应商返回的第一张图片，多余结果不会生成额外扣费项。
    const output = result.outputs[0];
    if (!output) throw new ImageProviderError("PROVIDER_EMPTY_IMAGE", true);
    const bytes = await time("provider_download", () =>
      providerOutputBytes(output, state.snapshot, key, deps.request),
    );
    const image = await time("image_storage", () =>
      deps.store.put(
        job,
        bytes,
        job.itemId,
        job.input.resolution === "1.5K"
          ? imageOutputDimensions(job.input.aspectRatio, job.input.resolution)
          : undefined,
        report,
      ),
    );
    await time("database_finish", () =>
      deps.repository.finish(job, { image, requestId: result.requestId }),
    );
  } catch (error) {
    await settleConfiguredFailure(job, deps, state, poll, sent, error);
  }
}
