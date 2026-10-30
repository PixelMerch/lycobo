import {
  apiErrorSchema,
  type ImageGenerationInput,
  imageAssetsResponseSchema,
  imageGenerationInputSchema,
  imageModelsResponseSchema,
  imageSessionResponseSchema,
  imageSubmissionResponseSchema,
  imageTaskRetrySchema,
  imageTasksResponseSchema,
  imageUploadResponseSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { normalizeApiResponse } from "../../lib/api-response";
import { sessionFetch } from "../../lib/session-fetch";
import { assetContentUrl, rememberImageDeliveries } from "./asset-delivery-client";

export { assetContentUrl } from "./asset-delivery-client";

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
  const response = await sessionFetch(`/api/v1/${path}`, {
    ...init,
    credentials: "same-origin",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "登录已过期，请重新登录工作台。",
      403: "当前操作没有权限。",
      400: "模型参数或参考图不受支持，请调整后重试。",
      409: "额度不足或提交参数冲突，请检查后重试。",
      413: "图片超过大小限制。",
      503: "生图服务尚未启用，请检查服务端配置。",
    };
    const failure = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ImageApiError(
      failure.success
        ? failure.data.message
        : (messages[response.status] ?? "服务暂时不可用，请稍后重试。"),
      response.status,
    );
  }
  const normalized = await normalizeApiResponse(response);
  if (normalized.headers.get("Content-Type")?.includes("application/json"))
    rememberImageDeliveries(await normalized.clone().json());
  return normalized;
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
export function useImageHistory(tool: "create" | "textile" | "all" | null = "create") {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: tool === "create" ? ["image-tasks"] : ["image-tasks", tool],
    enabled: session.isSuccess && tool !== null,
    initialPageParam: "",
    retry: false,
    staleTime: 30000,
    queryFn: async ({ pageParam, signal }) =>
      tool === null
        ? { data: [] }
        : imageTasksResponseSchema.parse(
            await (
              await imageRequest(
                `image-tasks?limit=20${tool === "all" ? "" : `&tool=${tool}`}${pageParam ? `&before=${pageParam}` : ""}`,
                {
                  signal,
                },
              )
            ).json(),
          ),
    getNextPageParam: (last) => (last.data.length === 20 ? last.data.at(-1)?.id : undefined),
  });
}
export function useDeleteHistoryTask() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: (id: string) =>
      imageRequest(`image-tasks/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["image-tasks"] }),
  });
}
export function useImageAssets({
  enabled = true,
  kind = "all",
  type,
}: {
  enabled?: boolean;
  kind?: "all" | "output" | "reference";
  type?: "image" | "video" | "audio" | undefined;
} = {}) {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: ["image-assets", kind, type ?? "all"],
    enabled: enabled && session.isSuccess,
    initialPageParam: "",
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      imageAssetsResponseSchema.parse(
        await (
          await imageRequest(
            `image-assets?limit=30${kind === "all" ? "" : `&kind=${kind}`}${type ? `&type=${type}` : ""}${pageParam ? `&before=${pageParam}` : ""}`,
            {
              signal,
            },
          )
        ).json(),
      ),
    getNextPageParam: (last) => (last.data.length === 30 ? last.data.at(-1)?.id : undefined),
  });
}
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
export function useGenerateImage() {
  const session = useImageSession();
  const client = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async ({
      model,
      draft,
      source,
      retryJobId,
      retryItemId,
      localEdit,
      textileSet,
    }: {
      model: ModelId;
      draft: Draft;
      source?: string;
      retryJobId?: string;
      retryItemId?: string;
      localEdit?: import("@lycoboai/contracts").ImageLocalEdit;
      textileSet?: import("@lycoboai/contracts").TextileGeneration | undefined;
    }) => {
      if (!session.data) throw new Error("请先登录工作台。");
      const pendingKey = pendingStorageKey(session.data);
      let pending = pendingSubmission(pendingKey);
      if (pending && pending.source !== source)
        throw new Error("请先在原提交入口确认上次提交，再开始新的生成。");
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
          quality:
            draft.quality === "低"
              ? "low"
              : draft.quality === "标准"
                ? "medium"
                : draft.quality === "高"
                  ? "high"
                  : draft.quality,
          aspectRatio: draft.ratio,
          count: Number(draft.count),
          referenceAssetIds,
          ...(localEdit ? { localEdit } : {}),
          ...(textileSet ? { textileSet } : {}),
        });
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
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      void client.invalidateQueries({ queryKey: ["image-tasks"] });
      void client.invalidateQueries({ queryKey: ["image-assets"] });
      void client.invalidateQueries({ queryKey: ["image-latest-edit"] });
    },
  });
}
/** Triggers the browser download for an owned asset without leaving the page. */
export function downloadAsset(id: string) {
  const link = document.createElement("a");
  link.href = assetContentUrl(id, false, true);
  link.download = `${id}.png`;
  link.referrerPolicy = "strict-origin-when-cross-origin";
  link.click();
}
