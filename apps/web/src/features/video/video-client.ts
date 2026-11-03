import {
  pendingVideoSchema,
  type VideoInput,
  videoAcceptedSchema,
  videoCapabilitySchema,
  videoInputSchema,
  videoTasksSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useEnterpriseSession } from "../auth/auth-client";
import {
  ImageApiError,
  imageRequest,
  uploadImageReferences,
} from "../generation/generation-client";
import type { ReferenceImage } from "../generation/studio-state";

export function useVideoModel() {
  const session = useEnterpriseSession();
  return useQuery({
    queryKey: ["video-model"],
    enabled: !!session.data,
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
export function useSubmitVideo() {
  const client = useQueryClient();
  const session = useEnterpriseSession();
  const locked = useRef(false);
  const storageKey = `lycobo-pending-video:${session.data?.organizationId}:${session.data?.userId}`;
  const pending = () => {
    try {
      return pendingVideoSchema.parse(JSON.parse(sessionStorage.getItem(storageKey) ?? "null"));
    } catch {
      return null;
    }
  };
  const [hasPending, setHasPending] = useState(() => !!pending());
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({
      input,
      references,
    }: {
      input: Omit<VideoInput, "referenceAssetIds">;
      references: ReferenceImage[];
    }) => {
      if (!session.data) throw new Error("请先登录");
      let attempt = pending();
      if (!attempt) {
        const ids = await uploadImageReferences(client, session.data, references);
        attempt = {
          key: crypto.randomUUID(),
          input: videoInputSchema.parse({ ...input, referenceAssetIds: ids }),
        };
        sessionStorage.setItem(storageKey, JSON.stringify(attempt));
        setHasPending(true);
      }
      const response = await imageRequest("video-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key },
        body: JSON.stringify(attempt.input),
      });
      const accepted = videoAcceptedSchema.parse(await response.json());
      sessionStorage.removeItem(storageKey);
      setHasPending(false);
      return accepted;
    },
    onError: (error) => {
      if (error instanceof ImageApiError && [400, 401, 403, 409, 413, 429].includes(error.status)) {
        sessionStorage.removeItem(storageKey);
        setHasPending(false);
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
    hasPending,
    submit: (args: Parameters<typeof mutation.mutate>[0]) => {
      if (locked.current) return;
      locked.current = true;
      mutation.mutate(args);
    },
  };
}
