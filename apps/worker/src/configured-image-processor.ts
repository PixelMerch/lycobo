import type { ClaimedImage, ImageRepository } from "@lycoboai/db";
import {
  configuredProviderCall,
  openProviderKey,
  ProviderPollError,
  providerOutputBytes,
  textileItemInput,
  VakvError,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
export async function processConfiguredImage(
  job: ClaimedImage,
  deps: {
    repository: ImageRepository;
    store: ImageStore;
    modelSecret?: string | undefined;
    request?: typeof fetch;
  },
) {
  const state = job.configuredProvider;
  if (!state) throw new Error("PROVIDER_SNAPSHOT_REQUIRED");
  const polling = state.phase === "polling" && !!state.taskId && !!state.statusPath;
  let sent = false;
  try {
    if (Date.now() > state.deadlineAt.getTime())
      throw new VakvError("PROVIDER_TASK_DEADLINE", true);
    if (!deps.modelSecret) throw new VakvError("MODEL_SECRET_NOT_CONFIGURED", polling);
    const key = await openProviderKey(
      await deps.repository.providerCipher(state.snapshot.credentialId),
      deps.modelSecret,
    );
    const references: Uint8Array[] = [];
    if (!polling)
      for (const id of job.input.referenceAssetIds) {
        const asset = await deps.repository.asset(job, id);
        if (!asset) throw new VakvError("REFERENCE_NOT_FOUND", false);
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
      await deps.repository.deferProvider(job, result.taskId, result.statusPath, result.delayMs);
      return;
    }
    if (result.outputs.length !== 1) throw new VakvError("PROVIDER_UNEXPECTED_IMAGE_COUNT", true);
    const output = result.outputs[0];
    if (!output) throw new VakvError("PROVIDER_EMPTY_IMAGE", true);
    const bytes = await providerOutputBytes(output, state.snapshot, key, deps.request);
    const image = await deps.store.put(job, bytes, job.itemId);
    await deps.repository.finish(job, { image });
  } catch (error) {
    const known = error instanceof VakvError;
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
      unknown: polling || sent ? (known ? error.unknownOutcome : true) : false,
    });
  }
}
