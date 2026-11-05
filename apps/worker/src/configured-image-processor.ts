import { imageOutputDimensions, providerModelForResolution } from "@lycoboai/contracts";
import type { ClaimedImage, ImageRuntimeRepository } from "@lycoboai/db";
import {
  configuredProviderCall,
  ImageProviderError,
  openProviderKey,
  ProviderPollError,
  type ProviderResult,
  providerOutputBytes,
  standaloneCredentialId,
  textileItemInput,
} from "@lycoboai/generation";
import type { ImageStore } from "@lycoboai/storage";
import type { DeliverProviderReference } from "./cloudbase-image-references";
import { mapProviderReferences, readProviderReferences } from "./provider-references";

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
  onDeferred?: ((delayMs: number) => void) | undefined;
};

type ConfiguredProvider = NonNullable<ClaimedImage["configuredProvider"]>;

async function configuredReferences(
  job: ClaimedImage,
  snapshot: ConfiguredProvider["snapshot"],
  deps: ConfiguredImageDependencies,
): Promise<{ bytes: Uint8Array[]; urls?: URL[] }> {
  const deliver = deps.deliverReference;
  if (
    deliver &&
    snapshot.adapter === "fluxport-images" &&
    snapshot.credentialId === standaloneCredentialId &&
    new URL(snapshot.origin).origin === "https://api.ai-media.vip" &&
    providerModelForResolution(snapshot, job.input.resolution) === "gpt-image-2.5-sunburst"
  ) {
    try {
      const urls = await mapProviderReferences(job, deps.repository, (asset) =>
        deliver(asset, !!job.input.localEdit),
      );
      return { bytes: [], urls };
    } catch {
      // No paid request has been sent, so the same attempt can still use inline images.
    }
  }
  return { bytes: await readProviderReferences(job, deps.repository, deps.store) };
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
    // Only an already-received callback needs immediate continuation. Otherwise exit:
    // the durable next_poll_at is recovered by a callback, visible batch read or timer.
    if (ready) deps.onDeferred?.(2000);
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
  if (
    poll &&
    Date.now() < state.deadlineAt.getTime() &&
    state.pollFailures < 4 &&
    !stopsPolling(error)
  ) {
    const delayMs = Math.min(
      60000,
      Math.max(
        5000 * 2 ** state.pollFailures,
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

export async function processConfiguredImage(job: ClaimedImage, deps: ConfiguredImageDependencies) {
  const state = job.configuredProvider;
  if (!state) throw new Error("PROVIDER_SNAPSHOT_REQUIRED");
  const poll =
    state.phase === "polling" && state.taskId && state.statusPath
      ? { taskId: state.taskId, statusPath: state.statusPath }
      : undefined;
  let sent = false;
  try {
    if (Date.now() > state.deadlineAt.getTime() && !(poll && state.snapshot.webhook))
      throw new ImageProviderError("PROVIDER_TASK_DEADLINE", true);
    const key = await readCredential(deps, state.snapshot.credentialId);
    if (!key) throw new ImageProviderError("MODEL_SECRET_NOT_CONFIGURED", !!poll);
    const references = poll ? { bytes: [] } : await configuredReferences(job, state.snapshot, deps);
    sent = true;
    const result = await configuredProviderCall(
      state.snapshot,
      key,
      textileItemInput(job.input, job.position),
      references.bytes,
      job.itemId,
      poll,
      deps.request,
      references.urls,
    );
    if (result.kind === "pending") {
      return await deferPendingImage(job, deps, state, result);
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
    await settleConfiguredFailure(job, deps, state, poll, sent, error);
  }
}
