import {
  apiErrorSchema,
  type ImageGenerationInput,
  type ImageJob,
  imageAssetsResponseSchema,
  imageGenerationInputSchema,
  imageModelsResponseSchema,
  imageSessionResponseSchema,
  imageSubmissionResponseSchema,
  imageTaskRetrySchema,
  imageTasksResponseSchema,
  imageUploadResponseSchema,
} from "@lycoboai/contracts";
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useSyncExternalStore } from "react";
import { normalizeApiResponse } from "../../lib/api-response";
import { sessionFetch } from "../../lib/session-fetch";
import { assetContentUrl, rememberImageDeliveries } from "./asset-delivery-client";
import { prepareReferenceUpload } from "./references/prepare-reference-upload";
import { referenceSizeError } from "./references/read-reference-images";

export { assetContentUrl } from "./asset-delivery-client";

import type { Draft, ModelId, ReferenceImage } from "./studio-state";

export class ImageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly businessCode?: string,
  ) {
    super(message);
  }
}
export async function imageRequest(path: string, init: RequestInit = {}, timeoutMs = 30000) {
  const response = await sessionFetch(`/api/v1/${path}`, {
    ...init,
    credentials: "same-origin",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
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
      failure.success ? failure.data.error.code : undefined,
    );
  }
  const normalized = await normalizeApiResponse(response);
  if (normalized.headers.get("Content-Type")?.includes("application/json"))
    rememberImageDeliveries(await normalized.clone().json());
  return normalized;
}
export function useImageSession(enabled = true) {
  return useQuery({
    queryKey: ["image-session"],
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      return imageSessionResponseSchema.parse(
        await (await imageRequest("image-session", { method: "POST", signal })).json(),
      );
    },
  });
}
export function useImageModels(enabled = true) {
  const session = useImageSession(enabled);
  return useQuery({
    queryKey: ["image-models"],
    enabled: enabled && session.isSuccess,
    retry: false,
    // Model capabilities change only with server configuration; avoid refetching on every focus.
    staleTime: 10 * 60 * 1000,
    queryFn: async ({ signal }) =>
      imageModelsResponseSchema.parse(
        await (await imageRequest("image-models", { signal })).json(),
      ),
  });
}
export function useImageHistory(
  tool: "create" | "textile" | "variation" | "all" | null = "create",
) {
  const session = useImageSession();
  return useInfiniteQuery<
    { data: ImageJob[] },
    Error,
    InfiniteData<{ data: ImageJob[] }, string>,
    readonly unknown[],
    string
  >({
    queryKey: tool === "create" ? ["image-tasks"] : ["image-tasks", tool],
    enabled: session.isSuccess && tool !== null,
    initialPageParam: "",
    retry: false,
    staleTime: 30000,
    // Unfinished tasks converge through useImageEvents, which refetches only those tasks
    // instead of every loaded history page.
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
  favorite = false,
}: {
  enabled?: boolean;
  kind?: "all" | "output" | "reference";
  type?: "image" | "video" | "audio" | undefined;
  favorite?: boolean;
} = {}) {
  const session = useImageSession();
  return useInfiniteQuery({
    queryKey: ["image-assets", kind, type ?? "all", favorite ? "favorite=true" : "any"],
    enabled: enabled && session.isSuccess,
    initialPageParam: "",
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      imageAssetsResponseSchema.parse(
        await (
          await imageRequest(
            `image-assets?limit=30${kind === "all" ? "" : `&kind=${kind}`}${type ? `&type=${type}` : ""}${favorite ? "&favorite=true" : ""}${pageParam ? `&before=${pageParam}` : ""}`,
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
export function useGenerateImage(enabled = true) {
  const session = useImageSession(enabled);
  const client = useQueryClient();
  const locked = useRef(false);
  const mutationKey = ["image-submission", session.data?.organizationId, session.data?.userId];
  const activeRequests = useIsMutating({ mutationKey });
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: async ({
      model,
      draft,
      source,
      retryJobId,
      retryItemId,
      localEdit,
      textileSet,
      variation,
    }: {
      model: ModelId;
      draft: Draft;
      source?: string;
      retryJobId?: string;
      retryItemId?: string;
      localEdit?: import("@lycoboai/contracts").ImageLocalEdit;
      textileSet?: import("@lycoboai/contracts").TextileGeneration | undefined;
      variation?: import("@lycoboai/contracts").VariationGeneration | undefined;
    }) => {
      if (!session.data) throw new Error("请先登录工作台。");
      const pendingKey = pendingStorageKey(session.data);
      let pending = pendingSubmission(pendingKey);
      if (pending && pending.source !== source)
        throw new Error("请先在原提交入口确认上次提交，再开始新的生成。");
      if (!pending) {
        const referenceAssetIds = await uploadImageReferences(
          client,
          session.data,
          draft.references,
        );
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
          ...(variation ? { variation } : {}),
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
    onSettled: () => {
      locked.current = false;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
      void client.invalidateQueries({ queryKey: ["image-tasks"] });
      void client.invalidateQueries({ queryKey: ["image-assets"] });
      void client.invalidateQueries({ queryKey: ["image-latest-edit"] });
    },
  });
  return {
    ...mutation,
    isPending: mutation.isPending || activeRequests > 0,
    mutate: (...args: Parameters<typeof mutation.mutate>) => {
      if (locked.current || activeRequests > 0) return;
      locked.current = true;
      mutation.mutate(...args);
    },
    mutateAsync: (...args: Parameters<typeof mutation.mutateAsync>) => {
      if (locked.current || activeRequests > 0)
        return Promise.reject(new Error("正在提交，请稍候"));
      locked.current = true;
      return mutation.mutateAsync(...args);
    },
  };
}
/** Triggers the browser download for an owned asset without leaving the page. */
export function downloadAsset(id: string) {
  const link = document.createElement("a");
  link.href = assetContentUrl(id, false, true);
  link.download = id;
  link.referrerPolicy = "strict-origin-when-cross-origin";
  link.click();
}
