import { imageOutputDimensions } from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import {
  type CapabilityOverrides,
  generateVakvImage,
  reportGenerationTiming,
  textileItemInput,
  type VakvConfig,
  VakvError,
  validateModelInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import { processConfiguredImage } from "./configured-image-processor";
import { providerReferenceBytes } from "./provider-references";

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
  onDeferred?: ((delayMs: number) => void) | undefined;
};
export async function processImageItem(itemId: string, deps: ImageProcessorDependencies) {
  const started = performance.now();
  const timing = (stage: string, since: number) =>
    reportGenerationTiming(deps.provider?.onTiming, {
      stage,
      durationMs: Math.round(performance.now() - since),
    });
  const job = await deps.repository.claim(
    itemId,
    deps.workerId,
    (deps.provider?.timeoutMs ?? 600000) + 60000,
  );
  timing("claim", started);
  if (!job) return;
  if (job.configuredProvider) return processConfiguredImage(job, deps);
  let submitted = false;
  try {
    if (!deps.provider?.key) throw new VakvError("MODEL_CHANNEL_NOT_CONFIGURED", false);
    validateModelInput(job.input, deps.overrides, deps.editsEnabled);
    const referencesStarted = performance.now();
    const references: Uint8Array[] = [];
    for (const id of job.input.referenceAssetIds) {
      const asset = await deps.repository.asset(job, id);
      if (!asset) throw new VakvError("REFERENCE_NOT_FOUND", false);
      references.push(await providerReferenceBytes(deps.store, asset, !!job.input.localEdit));
    }
    timing("reference_read", referencesStarted);
    submitted = true;
    const result = await generateVakvImage(
      textileItemInput(job.input, job.position),
      references,
      deps.provider,
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
    await deps.repository.finish(job, {
      errorCode: known
        ? error.code
        : submitted
          ? "OUTPUT_OUTCOME_UNKNOWN"
          : "REFERENCE_STORAGE_UNAVAILABLE",
      unknown: known ? error.unknownOutcome : submitted,
      requestId: known ? error.requestId : undefined,
    });
  }
}
