import { toast } from "@heroui/react";
import {
  type ImageJob,
  imageAssetsResponseSchema,
  imageModelsResponseSchema,
  imageSessionResponseSchema,
  imageTasksResponseSchema,
} from "@lycoboai/contracts";
import {
  type InfiniteData,
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";
import { refreshWithoutRealtime } from "../realtime/availability";
import { assetContentUrl } from "./asset-delivery-client";

export { assetContentUrl } from "./asset-delivery-client";

import { imageRequest } from "./image-request";
import { type ImageSubmission, submitImage } from "./image-submission";

export { ImageApiError, imageRequest } from "./image-request";
export {
  hasPendingSubmission,
  pendingSubmissionSource,
  uploadImageReferences,
  usePendingSubmission,
} from "./image-submission";

import { currentMessages } from "../../i18n/messages";
import { generationMessages } from "./generation-messages";

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
/** 按工具分页读取历史，未完成任务由实时事件单独同步。 */
export function useImageHistory(
  tool: "create" | "textile" | "variation" | "replica" | "all" | null = "create",
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
    // 未完成任务由实时事件定向刷新，不重复读取所有历史分页。
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
/** 提交生图任务，刷新余额与记录，并按入口选择成功反馈。 */
export function useGenerateImage({
  enabled = true,
  successFeedback = "toast",
}: {
  enabled?: boolean;
  successFeedback?: "toast" | "button";
} = {}) {
  const session = useImageSession(enabled);
  const client = useQueryClient();
  const locked = useRef(false);
  const mutationKey = ["image-submission", session.data?.organizationId, session.data?.userId];
  const activeRequests = useIsMutating({ mutationKey });
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: (submission: ImageSubmission) => {
      if (!session.data)
        return Promise.reject(new Error(currentMessages(generationMessages).signInFirst));
      return submitImage(client, session.data, submission);
    },
    onSettled: () => {
      locked.current = false;
    },
    onSuccess: () => {
      if (successFeedback === "toast")
        toast.success(currentMessages(generationMessages).submissionAccepted);
      // 账本事件与提交回执属于同一次变更，在线时交由唯一推送通道刷新余额。
      refreshWithoutRealtime(client, "wallet", "wallet-entries");
      void client.invalidateQueries({ queryKey: ["image-tasks"] });
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
        return Promise.reject(new Error(currentMessages(generationMessages).submittingWait));
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
