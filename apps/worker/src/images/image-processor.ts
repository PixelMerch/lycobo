import {
  type ImageGenerationInput,
  type ImageScope,
  imageOutputDimensions,
} from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import {
  type CapabilityOverrides,
  type GenerationTiming,
  generateVakvImage,
  reportGenerationTiming,
  textileItemInput,
  type VakvConfig,
  VakvError,
  validateModelInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { processConfiguredImage } from "./configured-image-processor";
import type { DeliverProviderReference } from "./provider-references";
import { mainImageHasReferences, readProviderReferences } from "./provider-references";

export type ImageProcessorDependencies = {
  repository: ImageRuntimeRepository;
  store: ImageStore;
  workerId: string;
  provider?: VakvConfig;
  overrides: CapabilityOverrides;
  editsEnabled: boolean;
  modelSecret?: string | undefined;
  standaloneKey?: string | undefined;
  request?: typeof fetch;
  deliverReference?: DeliverProviderReference;
  requireMainImageReferenceUrls?: boolean;
  prepareReferences?: ((itemId: string) => Promise<"ready" | "pending" | "failed">) | undefined;
  onDeferred?: ((delayMs: number) => void) | undefined;
  onWebhookAccepted?: ((ready: boolean) => void) | undefined;
  onTiming?: ((event: GenerationTiming & { itemId: string }) => void) | undefined;
};

function legacyProvider(input: ImageGenerationInput, deps: ImageProcessorDependencies) {
  if (deps.requireMainImageReferenceUrls && mainImageHasReferences(input))
    throw new VakvError("PROVIDER_REFERENCE_URL_REQUIRED", false);
  if (!deps.provider?.key) throw new VakvError("MODEL_CHANNEL_NOT_CONFIGURED", false);
  return deps.provider;
}

/** 领取前等待参考图，执行后返回已领取图片的账号，用于继续投递该账号的队列。 */
export async function processImageItem(
  itemId: string,
  deps: ImageProcessorDependencies,
): Promise<ImageScope | undefined> {
  const started = performance.now();
  const timing = (stage: string, since: number) =>
    reportGenerationTiming(deps.provider?.onTiming, {
      stage,
      durationMs: Math.round(performance.now() - since),
    });
  const references = await deps.prepareReferences?.(itemId);
  if (references === "pending") {
    deps.onDeferred?.(15000);
    return;
  }
  const job = await deps.repository.claim(
    itemId,
    deps.workerId,
    (deps.provider?.timeoutMs ?? 600000) + 60000,
  );
  timing("claim", started);
  if (!job) return;
  const scope = { organizationId: job.organizationId, userId: job.userId };
  if (references === "failed") {
    await deps.repository.finish(job, { errorCode: "REFERENCE_PROCESSING_FAILED", unknown: false });
    return scope;
  }
  if (job.configuredProvider) {
    await processConfiguredImage(job, deps);
    return scope;
  }
  let submitted = false;
  try {
    const provider = legacyProvider(job.input, deps);
    validateModelInput(job.input, deps.overrides, deps.editsEnabled);
    const referencesStarted = performance.now();
    const references = await readProviderReferences(job, deps.repository, deps.store);
    timing("reference_read", referencesStarted);
    submitted = true;
    const result = await generateVakvImage(
      textileItemInput(job.input, job.position),
      references,
      provider,
      job.itemId,
      deps.request,
      job.providerModel,
    );
    const storageStarted = performance.now();
    const image = await deps.store.put(
      job,
      result.bytes,
      job.itemId,
      job.input.resolution === "1.5K"
        ? imageOutputDimensions(job.input.aspectRatio, job.input.resolution)
        : undefined,
    );
    timing("image_storage", storageStarted);
    const finishStarted = performance.now();
    await deps.repository.finish(job, { image, requestId: result.requestId });
    timing("database_finish", finishStarted);
    timing("item_complete", started);
  } catch (error) {
    const known = error instanceof VakvError;
    const fallbackCode = submitted ? "OUTPUT_OUTCOME_UNKNOWN" : "REFERENCE_STORAGE_UNAVAILABLE";
    await deps.repository.finish(job, {
      errorCode: known ? error.code : fallbackCode,
      unknown: known ? error.unknownOutcome : submitted,
      requestId: known ? error.requestId : undefined,
    });
  }
  return scope;
}
