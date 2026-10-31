import type { ImageScope } from "@lycoboai/contracts";
import { ImageRepositoryError, type ImageRuntimeRepository } from "@lycoboai/db";
import {
  configuredProviderCall,
  ImageProviderError,
  openProviderKey,
  standaloneCredentialId,
} from "@lycoboai/generation";

/** Read accepted upstream tasks before allowing any replacement paid submission. */
export function providerRetryService(deps: {
  repository: Pick<
    ImageRuntimeRepository,
    "providerRetryCandidates" | "providerCipher" | "resumeProvider"
  >;
  modelSecret?: string | undefined;
  standaloneKey?: string | undefined;
  providerRequest?: typeof fetch | undefined;
}) {
  return async (scope: ImageScope, jobId: string, itemId?: string) => {
    const candidates = await deps.repository.providerRetryCandidates(scope, jobId, itemId);
    const resumable: string[] = [];
    for (const candidate of candidates) {
      const key =
        candidate.snapshot.credentialId === standaloneCredentialId
          ? deps.standaloneKey
          : deps.modelSecret
            ? await openProviderKey(
                await deps.repository.providerCipher(candidate.snapshot.credentialId),
                deps.modelSecret,
              )
            : undefined;
      if (!key) throw new ImageRepositoryError("STATE_CONFLICT");
      try {
        await configuredProviderCall(
          candidate.snapshot,
          key,
          candidate.input,
          [],
          candidate.itemId,
          { taskId: candidate.taskId, statusPath: candidate.statusPath },
          deps.providerRequest,
        );
        resumable.push(candidate.itemId);
      } catch (error) {
        // Only a definitive provider failure permits a replacement. A timeout,
        // missing/expired receipt or unavailable provider is not evidence of failure.
        if (!(error instanceof ImageProviderError) || error.code !== "PROVIDER_TASK_FAILED")
          throw new ImageRepositoryError("STATE_CONFLICT");
      }
    }
    for (const id of resumable) await deps.repository.resumeProvider(scope, jobId, id);
    return resumable.length > 0;
  };
}
