import { imageOutputDimensions } from "@lycoboai/contracts";
import type { ClaimedImage, ImageRepository } from "@lycoboai/db";
import {
  configuredProviderCall,
  ImageProviderError,
  openProviderKey,
  ProviderPollError,
  providerOutputBytes,
  standaloneCredentialId,
  textileItemInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
export async function processConfiguredImage(
  job: ClaimedImage,
  deps: {
    repository: ImageRepository;
    store: ImageStore;
    modelSecret?: string | undefined;
    standaloneKey?: string | undefined;
    request?: typeof fetch;
  },
) {
  const state = job.configuredProvider;
  if (!state) throw new Error("PROVIDER_SNAPSHOT_REQUIRED");
  const polling = state.phase === "polling" && !!state.taskId && !!state.statusPath;
  let sent = false;
  try {
    if (Date.now() > state.deadlineAt.getTime())
      throw new ImageProviderError("PROVIDER_TASK_DEADLINE", true);
    const key =
      state.snapshot.credentialId === standaloneCredentialId
        ? deps.standaloneKey
        : deps.modelSecret
          ? await openProviderKey(
              await deps.repository.providerCipher(state.snapshot.credentialId),
              deps.modelSecret,
            )
          : undefined;
    if (!key) throw new ImageProviderError("MODEL_SECRET_NOT_CONFIGURED", polling);
    const references: Uint8Array[] = [];
    if (!polling)
      for (const id of job.input.referenceAssetIds) {
        const asset = await deps.repository.asset(job, id);
        if (!asset) throw new ImageProviderError("REFERENCE_NOT_FOUND", false);
        references.push(await deps.store.read(asset));
      }
    sent = true;
    const result = await configuredProviderCall(
      state.snapshot,
      key,
      textileItemInput(job.input, job.position),
      references,
      job.itemId,
      polling && state.taskId && state.statusPath
        ? { taskId: state.taskId, statusPath: state.statusPath }
        : undefined,
      deps.request,
    );
    if (result.kind === "pending") {
      await deps.repository.deferProvider(
        job,
        result.taskId,
        result.statusPath,
        result.delayMs,
        false,
        result.requestId,
      );
      return;
    }
    // A paid slot requests n=1; surplus provider outputs must not discard its usable result.
    // Preserve stable provider order and deliver one image without creating extra charges/items.
    const output = result.outputs[0];
    if (!output) throw new ImageProviderError("PROVIDER_EMPTY_IMAGE", true);
    const bytes = await providerOutputBytes(output, state.snapshot, key, deps.request);
    const image = await deps.store.put(
      job,
      bytes,
      job.itemId,
      job.input.resolution === "1.5K"
        ? imageOutputDimensions(job.input.aspectRatio, job.input.resolution)
        : undefined,
    );
    await deps.repository.finish(job, { image, requestId: result.requestId });
  } catch (error) {
    const known = error instanceof ImageProviderError;
    if (
      polling &&
      state.taskId &&
      state.statusPath &&
      Date.now() < state.deadlineAt.getTime() &&
      state.pollFailures < 4 &&
      !(
        known &&
        [
          "PROVIDER_TASK_FAILED",
          "PROVIDER_POLL_STOPPED",
          "PROVIDER_OUTCOME_UNKNOWN",
          "PROVIDER_UNTRUSTED_TASK_URL",
          "PROVIDER_UNTRUSTED_RESULT_URL",
        ].includes(error.code)
      )
    ) {
      await deps.repository.deferProvider(
        job,
        state.taskId,
        state.statusPath,
        Math.min(
          60000,
          Math.max(
            5000 * 2 ** state.pollFailures,
            error instanceof ProviderPollError ? error.delayMs : 0,
          ),
        ),
        true,
      );
      return;
    }
    await deps.repository.finish(job, {
      errorCode: known ? error.code : "CONFIGURED_PROVIDER_UNAVAILABLE",
      requestId: known ? error.requestId : undefined,
      unknown: polling || sent ? (known ? error.unknownOutcome : true) : false,
    });
  }
}
