import {
  pendingVideoSchema,
  type VideoCreateInput,
  videoAcceptedSchema,
  videoCapabilitySchema,
  videoCreateSchema,
  videoTasksSchema,
} from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useSyncExternalStore } from "react";
import { currentMessages } from "../../i18n/messages";
import { useEnterpriseSession } from "../auth/auth-client";
import {
  ImageApiError,
  imageRequest,
  uploadImageReferences,
} from "../generation/generation-client";
import type { ReferenceImage } from "../generation/studio-state";
import { videoMessages } from "./video-messages";
import { clearSubmittedVideoDraft, useVideoDraft } from "./video-state";

const pendingEvents = new EventTarget();
const notifyPending = () => pendingEvents.dispatchEvent(new Event("change"));
const subscribePending = (listener: () => void) => {
  pendingEvents.addEventListener("change", listener);
  return () => pendingEvents.removeEventListener("change", listener);
};

export function useVideoModel(enabled = true) {
  const session = useEnterpriseSession();
  return useQuery({
    queryKey: ["video-model"],
    enabled: enabled && !!session.data,
    retry: false,
    queryFn: async ({ signal }) =>
      videoCapabilitySchema.parse(await (await imageRequest("video-model", { signal })).json()),
  });
}
export function useVideoTasks() {
  const session = useEnterpriseSession();
  const model = useVideoModel();
  return useInfiniteQuery({
    queryKey: ["video-tasks", session.data?.organizationId, session.data?.userId],
    enabled: !!session.data && model.data?.enabled === true,
    initialPageParam: "",
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      videoTasksSchema.parse(
        await (
          await imageRequest(`video-tasks${pageParam ? `?before=${pageParam}` : ""}`, { signal })
        ).json(),
      ),
    getNextPageParam: (last) => (last.data.length === 20 ? last.data.at(-1)?.id : undefined),
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.data.some((task) => ["queued", "running"].includes(task.status)),
      )
        ? 10000
        : false,
  });
}
/** 提交视频任务：同一账号同时只允许一个提交，回执丢失时用同一个请求确认。 */
export function useSubmitVideo(source?: "storyboard") {
  const client = useQueryClient();
  const session = useEnterpriseSession();
  const locked = useRef(false);
  const storageKey = `lycobo-pending-video:${session.data?.organizationId}:${session.data?.userId}`;
  const pending = () => readPendingVideo(storageKey);
  const pendingSource = useSyncExternalStore(subscribePending, () => {
    const attempt = pending();
    return attempt ? (attempt.source ?? "direct") : null;
  });
  const hasPending = pendingSource === (source ?? "direct");
  const activeSubmissions = useIsMutating({ mutationKey: ["submit-video"] });
  const mutation = useMutation({
    mutationKey: ["submit-video"],
    retry: false,
    mutationFn: (args: VideoSubmission) => {
      if (!session.data) throw new Error(currentMessages(videoMessages).signInFirst);
      return submitVideoAttempt(args, session.data, source, storageKey, client);
    },
    onError: (error, { repairPending }) => {
      if (
        !repairPending &&
        error instanceof ImageApiError &&
        [400, 401, 403, 409, 413, 429].includes(error.status)
      ) {
        sessionStorage.removeItem(storageKey);
        notifyPending();
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["video-tasks"] });
      void client.invalidateQueries({ queryKey: ["wallet"] });
      void client.invalidateQueries({ queryKey: ["wallet-entries"] });
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  return {
    ...mutation,
    isPending: mutation.isPending || activeSubmissions > 0,
    hasPending,
    pendingReferenceCount: hasPending ? pending()?.input.referenceAssetIds.length : undefined,
    blockedByPending: pendingSource !== null && !hasPending,
    submitAsync: (args: Parameters<typeof mutation.mutateAsync>[0]) => {
      if (locked.current || activeSubmissions > 0)
        return Promise.reject(new Error(currentMessages(videoMessages).submittingWait));
      locked.current = true;
      return mutation.mutateAsync(args);
    },
    submit: (args: Parameters<typeof mutation.mutate>[0]) => {
      if (locked.current || activeSubmissions > 0) return;
      locked.current = true;
      mutation.mutate(args);
    },
  };
}

type PendingVideo = ReturnType<typeof pendingVideoSchema.parse>;
type VideoSubmission = {
  input: Omit<VideoCreateInput, "referenceAssetIds">;
  references: ReferenceImage[];
  clearDraft?: boolean;
  repairPending?: boolean;
};

function readPendingVideo(storageKey: string) {
  try {
    return pendingVideoSchema.parse(JSON.parse(sessionStorage.getItem(storageKey) ?? "null"));
  } catch {
    return null;
  }
}

function buildVideoAttempt(
  input: VideoSubmission["input"],
  ids: string[],
  client: QueryClient,
  source: PendingVideo["source"],
  key: string,
): PendingVideo {
  const { storyboard, storyboardOriginalImageCount, ...video } = input;
  const capability = client.getQueryData<ReturnType<typeof videoCapabilitySchema.parse>>([
    "video-model",
  ]);
  return {
    key: key,
    source,
    input: videoCreateSchema.parse({
      ...video,
      referenceAssetIds: ids,
      ...(storyboard && capability?.storyboardHistory
        ? {
            storyboard,
            ...(capability.maxStoryboardOriginalImages && storyboardOriginalImageCount !== undefined
              ? { storyboardOriginalImageCount }
              : {}),
          }
        : {}),
    }),
  };
}

function sendVideoAttempt(attempt: PendingVideo, original: PendingVideo | null) {
  const submit = (submission: PendingVideo) =>
    imageRequest("video-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": submission.key },
      body: JSON.stringify(submission.input),
    });
  return submit(attempt).catch((error: unknown) => {
    // Legacy drafts could reach video submission with missing frames. Reuse their key.
    // A conflict means a task already owns that key, so recover its original receipt.
    if (original && error instanceof ImageApiError && error.businessCode === "IDEMPOTENCY_CONFLICT")
      return submit(original);
    throw error;
  });
}

async function submitVideoAttempt(
  { input, references, clearDraft = true, repairPending = false }: VideoSubmission,
  owner: NonNullable<ReturnType<typeof useEnterpriseSession>["data"]>,
  source: PendingVideo["source"],
  storageKey: string,
  client: QueryClient,
) {
  const pending = () => readPendingVideo(storageKey);
  const submittedDraft = useVideoDraft.getState();
  let attempt = pending();
  if (attempt && attempt.source !== source)
    throw new Error(currentMessages(videoMessages).confirmInVideo);
  const confirming = !!attempt;
  const original = repairPending ? attempt : null;
  if (!attempt || original) {
    const ids = await uploadImageReferences(client, owner, references);
    if (pending()?.key !== attempt?.key)
      throw new Error(currentMessages(videoMessages).pendingVideo);
    attempt = buildVideoAttempt(input, ids, client, source, original?.key ?? crypto.randomUUID());
    if (!original) {
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      notifyPending();
    }
  }
  const response = await sendVideoAttempt(attempt, original).catch((error: unknown) => {
    if (error instanceof ImageApiError && error.businessCode === "VIDEO_REFERENCES_UNAVAILABLE") {
      // 首次提交被拒发生在创建任务之前；确认请求可能对应早先已接受的任务，原请求键必须保留。
      if (!confirming) {
        sessionStorage.removeItem(storageKey);
        notifyPending();
      }
      void client.invalidateQueries({ queryKey: ["video-model"] });
    }
    throw error;
  });
  const accepted = videoAcceptedSchema.parse(await response.json());
  sessionStorage.removeItem(storageKey);
  notifyPending();
  if (clearDraft && !confirming) clearSubmittedVideoDraft(submittedDraft);
  return accepted;
}
