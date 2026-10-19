import {
  type ImageGenerationInput,
  imageAssetsResponseSchema,
  imageGenerationInputSchema,
  imageModelsResponseSchema,
  imageSessionResponseSchema,
  imageSubmissionResponseSchema,
  imageTasksResponseSchema,
  imageUploadResponseSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import type { Draft, ModelId } from "./studio-state";

export class ImageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function imageRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api/v1/${path}`, {
    ...init,
    credentials: "same-origin",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "请先登录工作台，或检查本地身份配置。",
      403: "当前操作没有权限。",
      400: "模型参数或参考图不受支持，请调整后重试。",
      409: "额度不足或提交参数冲突，请检查后重试。",
      413: "图片超过大小限制。",
      503: "生图服务尚未启用，请检查服务端配置。",
    };
    throw new ImageApiError(
      messages[response.status] ?? "服务暂时不可用，请稍后重试。",
      response.status,
    );
  }
  return response;
}
export function useImageSession() {
  return useQuery({
    queryKey: ["image-session"],
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      return imageSessionResponseSchema.parse(
        await (await imageRequest("image-session", { method: "POST", signal })).json(),
      );
    },
  });
}
export function useImageModels() {
  const session = useImageSession();
  return useQuery({
    queryKey: ["image-models"],
    enabled: session.isSuccess,
    retry: false,
    queryFn: async ({ signal }) =>
      imageModelsResponseSchema.parse(
        await (await imageRequest("image-models", { signal })).json(),
      ),
  });
}
export function useImageHistory() {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: ["image-tasks"],
    enabled: session.isSuccess,
    initialPageParam: "",
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      imageTasksResponseSchema.parse(
        await (
          await imageRequest(`image-tasks?limit=20${pageParam ? `&before=${pageParam}` : ""}`, {
            signal,
          })
        ).json(),
      ),
    getNextPageParam: (last) => (last.data.length === 20 ? last.data.at(-1)?.id : undefined),
    refetchInterval: 3000,
  });
}
export function useImageAssets() {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: ["image-assets"],
    enabled: session.isSuccess,
    initialPageParam: "",
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      imageAssetsResponseSchema.parse(
        await (
          await imageRequest(`image-assets?limit=30${pageParam ? `&before=${pageParam}` : ""}`, {
            signal,
          })
        ).json(),
      ),
    getNextPageParam: (last) => (last.data.length === 30 ? last.data.at(-1)?.id : undefined),
    refetchInterval: 5000,
  });
}
type SessionScope = { organizationId: string; userId: string };
const pendingStorageKey = (scope: SessionScope) =>
  `lycobo-pending-image-submission:${scope.organizationId}:${scope.userId}`;
function pendingSubmission(
  pendingKey: string,
): { key: string; input: ImageGenerationInput } | null {
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
  return { key: value.key, input: imageGenerationInputSchema.parse(value.input) };
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
export function useGenerateImage() {
  const session = useImageSession();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async ({ model, draft }: { model: ModelId; draft: Draft }) => {
      if (!session.data) throw new Error("请先登录工作台。");
      const pendingKey = pendingStorageKey(session.data);
      let pending = pendingSubmission(pendingKey);
      if (!pending) {
        const referenceAssetIds: string[] = [];
        for (const reference of draft.references) {
          if (reference.assetId) {
            referenceAssetIds.push(reference.assetId);
            continue;
          }
          const blob = await (
            await fetch(reference.src, { signal: AbortSignal.timeout(30000) })
          ).blob();
          const upload = await imageRequest("image-assets", {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          });
          referenceAssetIds.push(imageUploadResponseSchema.parse(await upload.json()).id);
        }
        const input = imageGenerationInputSchema.parse({
          model,
          prompt: draft.prompt,
          resolution: draft.resolution,
          aspectRatio: draft.ratio,
          count: Number(draft.count),
          referenceAssetIds,
        });
        pending = { key: crypto.randomUUID(), input };
        // Retain the same request after a lost response or reload: never create another paid task blindly.
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
        window.dispatchEvent(new Event(pendingEvent));
      }
      try {
        const result = imageSubmissionResponseSchema.parse(
          await (
            await imageRequest("image-tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key },
              body: JSON.stringify(pending.input),
            })
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
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["image-tasks"] });
      void client.invalidateQueries({ queryKey: ["image-assets"] });
    },
  });
}
export const assetContentUrl = (id: string, thumbnail = false) =>
  `/api/v1/image-assets/${id}/content${thumbnail ? "?thumbnail=1" : ""}`;
