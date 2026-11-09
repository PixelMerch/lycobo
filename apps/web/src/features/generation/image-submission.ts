import {
  type ImageGenerationInput,
  imageGenerationInputSchema,
  imageSubmissionResponseSchema,
  imageTaskRetrySchema,
} from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { currentMessages } from "../../i18n/messages";
import { generationMessages } from "./generation-messages";
import { ImageApiError, imageRequest } from "./image-request";
import { completeReferenceUpload } from "./references/complete-reference-upload";
import { prepareReferenceUpload } from "./references/prepare-reference-upload";
import { referenceSizeError } from "./references/read-reference-images";
import type { Draft, ModelId, ReferenceImage } from "./studio-state";

type SessionScope = { organizationId: string; userId: string };
const pendingStorageKey = (scope: SessionScope) =>
  `lycobo-pending-image-submission:${scope.organizationId}:${scope.userId}`;
function pendingSubmission(pendingKey: string): {
  key: string;
  input: ImageGenerationInput;
  retryJobId?: string | undefined;
  retryItemId?: string | undefined;
  source?: string | undefined;
} | null {
  const raw = sessionStorage.getItem(pendingKey);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("key" in value) ||
    typeof value.key !== "string" ||
    !("input" in value)
  )
    throw new Error(currentMessages(generationMessages).pendingUnreadable);
  return {
    key: value.key,
    retryJobId:
      "retryJobId" in value && typeof value.retryJobId === "string" ? value.retryJobId : undefined,
    retryItemId:
      "retryItemId" in value
        ? imageTaskRetrySchema.parse({ itemId: value.retryItemId }).itemId
        : undefined,
    input: imageGenerationInputSchema.parse(value.input),
    source: "source" in value && typeof value.source === "string" ? value.source : undefined,
  };
}
export function pendingSubmissionSource(scope: SessionScope) {
  return pendingSubmission(pendingStorageKey(scope))?.source;
}
export function hasPendingSubmission(scope?: SessionScope) {
  return !!scope && sessionStorage.getItem(pendingStorageKey(scope)) !== null;
}
const pendingEvent = "lycobo-image-submission-change";
function subscribePending(listener: () => void) {
  window.addEventListener(pendingEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(pendingEvent, listener);
    window.removeEventListener("storage", listener);
  };
}
export function usePendingSubmission(scope?: SessionScope) {
  return useSyncExternalStore(
    subscribePending,
    () => hasPendingSubmission(scope),
    () => false,
  );
}
/** 最多同时上传三张参考图，保留编号顺序并复用查询缓存，避免跨境等待逐张累加。 */
export async function uploadImageReferences(
  client: QueryClient,
  scope: SessionScope,
  references: readonly ReferenceImage[],
) {
  const ids: string[] = [];
  for (let offset = 0; offset < references.length; offset += 3) {
    const assets = await Promise.all(
      references
        .slice(offset, offset + 3)
        .map((reference, index) =>
          reference.assetId
            ? Promise.resolve({ id: reference.assetId })
            : uploadReference(client, scope, reference, offset + index),
        ),
    );
    ids.push(...assets.map((asset) => asset.id));
  }
  return ids;
}

function uploadReference(
  client: QueryClient,
  scope: SessionScope,
  reference: ReferenceImage,
  index: number,
) {
  return client.fetchQuery({
    queryKey: ["reference-upload", scope.organizationId, scope.userId, reference.id],
    staleTime: 2 * 24 * 60 * 60 * 1000,
    gcTime: 2 * 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const blob = await (
        await fetch(reference.src, { signal: AbortSignal.timeout(30000) })
      ).blob();
      const position = index + 1;
      const issue = referenceSizeError(blob.size, position);
      if (issue) throw new Error(issue);
      const prepared = await prepareReferenceUpload(blob, position);
      const upload = await imageRequest("image-assets", {
        method: "POST",
        headers: { "Content-Type": prepared.type },
        body: prepared,
      }).catch((error: unknown) => {
        if (error instanceof ImageApiError && [406, 413].includes(error.status)) {
          throw new ImageApiError(
            currentMessages(generationMessages).uploadTooLarge(position),
            error.status,
            error.businessCode,
          );
        }
        throw error;
      });
      const uploaded = await completeReferenceUpload(upload);
      void client.invalidateQueries({ queryKey: ["image-assets"] });
      return uploaded;
    },
  });
}
export type ImageSubmission = {
  model: ModelId;
  draft: Draft;
  source?: string;
  retryJobId?: string;
  retryItemId?: string;
  localEdit?: import("@lycoboai/contracts").ImageLocalEdit;
  textileSet?: import("@lycoboai/contracts").TextileGeneration | undefined;
  variation?: import("@lycoboai/contracts").VariationGeneration | undefined;
};

async function prepareSubmissionInput(
  client: QueryClient,
  scope: SessionScope,
  { model, draft, localEdit, textileSet, variation }: ImageSubmission,
) {
  const referenceAssetIds = await uploadImageReferences(client, scope, draft.references);
  return imageGenerationInputSchema.parse({
    model,
    prompt: draft.prompt,
    resolution: draft.resolution,
    quality: draft.quality,
    aspectRatio: draft.ratio,
    count: Number(draft.count),
    referenceAssetIds,
    ...(localEdit ? { localEdit } : {}),
    ...(textileSet ? { textileSet } : {}),
    ...(variation ? { variation } : {}),
  });
}

/** 提交生图任务：先保存待确认的请求，回执丢失或刷新后用同一个请求确认，不重复扣费。 */
export async function submitImage(
  client: QueryClient,
  scope: SessionScope,
  submission: ImageSubmission,
) {
  const { source, retryJobId, retryItemId } = submission;
  const pendingKey = pendingStorageKey(scope);
  let pending = pendingSubmission(pendingKey);
  if (pending && pending.source !== source)
    throw new Error(currentMessages(generationMessages).confirmElsewhere);
  if (!pending) {
    const input = await prepareSubmissionInput(client, scope, submission);
    pending = { key: crypto.randomUUID(), input, source, retryJobId, retryItemId };
    // 回执丢失或刷新后保留同一个请求，绝不盲目再建一个付费任务。
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    window.dispatchEvent(new Event(pendingEvent));
  }
  try {
    const result = imageSubmissionResponseSchema.parse(
      await (
        await imageRequest(
          pending.retryJobId
            ? `image-tasks/${encodeURIComponent(pending.retryJobId)}/retry`
            : "image-tasks",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key },
            body: JSON.stringify(
              pending.retryItemId ? { itemId: pending.retryItemId } : pending.input,
            ),
          },
        )
      ).json(),
    );
    sessionStorage.removeItem(pendingKey);
    window.dispatchEvent(new Event(pendingEvent));
    return result;
  } catch (error) {
    if (error instanceof ImageApiError && [400, 409, 413, 415, 422].includes(error.status)) {
      sessionStorage.removeItem(pendingKey);
      window.dispatchEvent(new Event(pendingEvent));
    }
    throw error;
  }
}
