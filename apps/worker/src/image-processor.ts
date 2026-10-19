import type { ImageRepository } from "@lycoboai/db";
import {
  type CapabilityOverrides,
  generateVakvImage,
  type VakvConfig,
  VakvError,
  validateModelInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";

export type ImageProcessorDependencies = {
  repository: ImageRepository;
  store: ImageStore;
  workerId: string;
  provider: VakvConfig;
  overrides: CapabilityOverrides;
  editsEnabled: boolean;
  request?: typeof fetch;
};
export async function processImageItem(itemId: string, deps: ImageProcessorDependencies) {
  const job = await deps.repository.claim(itemId, deps.workerId, deps.provider.timeoutMs + 60000);
  if (!job) return;
  let submitted = false;
  try {
    validateModelInput(job.input, deps.overrides, deps.editsEnabled);
    const references: Uint8Array[] = [];
    for (const id of job.input.referenceAssetIds) {
      const asset = await deps.repository.asset(job, id);
      if (!asset) throw new VakvError("REFERENCE_NOT_FOUND", false);
      references.push(await deps.store.read(asset));
    }
    submitted = true;
    const result = await generateVakvImage(
      job.input,
      references,
      deps.provider,
      job.itemId,
      deps.request,
    );
    const image = await deps.store.put(job, result.bytes, job.itemId);
    await deps.repository.finish(job, { image, requestId: result.requestId });
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
