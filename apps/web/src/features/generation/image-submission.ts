import {
  type ImageGenerationInput,
  imageGenerationInputSchema,
  imageSubmissionResponseSchema,
  imageTaskRetrySchema,
  imageUploadResponseSchema,
} from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { ImageApiError, imageRequest } from "./image-request";
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
    throw new Error("待确认的提交信息无法读取，请联系管理员核对历史记录。");
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
export async function uploadImageReferences(
  client: QueryClient,
  scope: SessionScope,
  references: readonly ReferenceImage[],
) {
  const referenceAssetIds: string[] = [];
  for (const [index, reference] of references.entries()) {
    if (reference.assetId) {
      referenceAssetIds.push(reference.assetId);
      continue;
    }
    const asset = await client.fetchQuery({
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
              `第 ${position} 张图片超过当前上传入口允许的大小，请缩小图片后重试。`,
              error.status,
              error.businessCode,
            );
          }
          throw error;
        });
        const uploaded = imageUploadResponseSchema.parse(await upload.json());
        void client.invalidateQueries({ queryKey: ["image-assets"] });
        return uploaded;
      },
    });
    referenceAssetIds.push(asset.id);
  }
  return referenceAssetIds;
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

function requestQuality(quality: string) {
  if (quality === "低") return "low";
  if (quality === "标准") return "medium";
  if (quality === "高") return "high";
  return quality;
}

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
    quality: requestQuality(draft.quality),
    aspectRatio: draft.ratio,
    count: Number(draft.count),
    referenceAssetIds,
    ...(localEdit ? { localEdit } : {}),
    ...(textileSet ? { textileSet } : {}),
    ...(variation ? { variation } : {}),
  });
}

export async function submitImage(
  client: QueryClient,
  scope: SessionScope,
  submission: ImageSubmission,
) {
  const { source, retryJobId, retryItemId } = submission;
  const pendingKey = pendingStorageKey(scope);
  let pending = pendingSubmission(pendingKey);
  if (pending && pending.source !== source)
    throw new Error("请先在原提交入口确认上次提交，再开始新的生成。");
  if (!pending) {
    const input = await prepareSubmissionInput(client, scope, submission);
    pending = { key: crypto.randomUUID(), input, source, retryJobId, retryItemId };
    // Retain the same request after a lost response or reload: never create another paid task blindly.
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
