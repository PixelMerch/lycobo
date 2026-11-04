import {
  imageJobSchema,
  type StoryboardRequest,
  storyboardVideoShotLimit,
  type VariationPlan,
  variationCapabilitiesSchema,
  variationPlanSchema,
} from "@lycoboai/contracts";
import {
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useErrorToast } from "../../../lib/error-toast";
import { enterpriseSessionKey, useEnterpriseSession } from "../../auth/auth-client";
import {
  ImageApiError,
  imageRequest,
  pendingSubmissionSource,
  uploadImageReferences,
  useGenerateImage,
  useImageModels,
  usePendingSubmission,
} from "../../generation/generation-client";
import { revealNewestHistory } from "../../generation/history/history-navigation";
import { modelCapabilities, supportsReferences } from "../../generation/models/model-capabilities";
import { useSubmitVideo, useVideoModel } from "../video-client";
import { emptyStoryboard, originalReference, useStoryboardState } from "./storyboard-state";

const source = "tk-storyboard";
const imageModel = "gpt-image-2.5";
const resolution = "1.5K";
const running = (status?: string) => status === "queued" || status === "running";
const definitive = (error: unknown) =>
  error instanceof ImageApiError && [400, 401, 403, 409, 413, 429].includes(error.status);
const readPlan = async (id: string, signal?: AbortSignal) =>
  variationPlanSchema.parse(
    await (await imageRequest(`variation-plans/${id}`, { signal: signal ?? null })).json(),
  );

export function useStoryboard(enabled: boolean, onReview: () => void) {
  const session = useEnterpriseSession();
  const owner = session.data ?? undefined;
  const scope = owner ? `${owner.organizationId}:${owner.userId}` : "";
  const draft = useStoryboardState((state) => state.drafts[scope]) ?? emptyStoryboard;
  const { progress } = draft;
  const client = useQueryClient();
  const generation = useGenerateImage(enabled);
  const models = useImageModels(enabled);
  const videoModel = useVideoModel(enabled);
  const video = useSubmitVideo("storyboard");
  const pendingImage = usePendingSubmission(owner);
  let ownImagePending = false;
  if (enabled && owner && pendingImage) {
    try {
      ownImagePending = pendingSubmissionSource(owner) === source;
    } catch {
      // A damaged confirmation record still blocks new paid submissions.
    }
  }
  const lock = useRef(false);
  useEffect(() => {
    if (enabled) useStoryboardState.getState().load(scope);
  }, [enabled, scope]);
  const current = () => useStoryboardState.getState().drafts[scope] ?? emptyStoryboard;
  const update = (patch: Partial<typeof draft>) =>
    useStoryboardState.getState().update(scope, patch);
  const save = (patch: Partial<typeof progress>) =>
    update({ progress: { ...current().progress, ...patch } });
  const planKey = (id?: string) => ["tk-storyboard-plan", scope, id] as const;
  const capabilities = useQuery({
    queryKey: ["tk-storyboard-capabilities", scope],
    enabled: enabled && !!scope,
    retry: false,
    queryFn: async ({ signal }) =>
      variationCapabilitiesSchema.parse(
        await (await imageRequest("video-storyboards/capabilities", { signal })).json(),
      ),
  });
  const planQuery = useQuery({
    queryKey: planKey(progress.planId),
    enabled: enabled && !!scope && !!progress.planId,
    staleTime: 60_000,
    retry: false,
    queryFn: ({ signal }) => readPlan(progress.planId ?? "", signal),
  });
  const jobIds = [
    ...new Set(
      [progress.batchId, ...Object.values(progress.replacements).flat()].filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  const jobs = useQueries({
    queries: jobIds.map((id) =>
      queryOptions({
        queryKey: ["tk-storyboard-image", scope, id],
        enabled: enabled && !!scope,
        retry: false,
        queryFn: async ({ signal }) =>
          imageJobSchema.parse(await (await imageRequest(`image-tasks/${id}`, { signal })).json()),
        refetchInterval: (query) => (running(query.state.data?.status) ? 4000 : false),
      }),
    ),
  });
  const results = new Map(jobIds.map((id, index) => [id, jobs[index]?.data]));
  const plan = planQuery.data;
  const order = progress.order.length ? progress.order : (plan?.items.map((item) => item.id) ?? []);
  const shots = order.flatMap((id) => {
    const position = plan?.items.findIndex((item) => item.id === id) ?? -1;
    const item = plan?.items[position];
    if (!item) return [];
    const replacementIds = progress.replacements[id] ?? [];
    const previous = results
      .get(progress.batchId ?? "")
      ?.items.find((entry) => entry.position === position);
    const replacements = replacementIds.map((jobId) => results.get(jobId)?.items[0]);
    const latest = replacementIds.length ? replacements.at(-1) : previous;
    const finished =
      [...replacements].reverse().find((entry) => entry?.status === "succeeded") ??
      (previous?.status === "succeeded" ? previous : undefined);
    const image = finished?.output_asset_id ?? null;
    const pending = !!progress.batchId && (!latest || running(latest.status));
    return [
      {
        ...item,
        image,
        pending,
        uncertain: latest?.status === "needs_reconciliation",
        failed: latest?.status === "failed",
        selected: !progress.excluded.includes(id),
        completedReplacement: [...replacementIds]
          .reverse()
          .find((jobId) => results.get(jobId)?.items[0]?.status === "succeeded"),
      },
    ];
  });
  const selected = shots.filter((shot) => shot.selected);
  const model = modelCapabilities(models.data, imageModel, "create");
  const canDraw = model?.enabledResolutions.includes(resolution) && supportsReferences(model, 1);

  function assertCurrentOwner() {
    const identity = client.getQueryData<typeof owner>(enterpriseSessionKey);
    if (
      !identity ||
      identity.organizationId !== owner?.organizationId ||
      identity.userId !== owner.userId
    )
      throw new Error("登录身份已变化，请回到原账号继续分镜");
  }

  async function requestPlan(attempt: { key: string; input: StoryboardRequest }) {
    assertCurrentOwner();
    const response = await imageRequest(
      "video-storyboards",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key },
        body: JSON.stringify(attempt.input),
      },
      90_000,
    );
    return variationPlanSchema.parse(await response.json());
  }

  async function submitImages(snapshot: VariationPlan, target: string) {
    assertCurrentOwner();
    const original = snapshot.referenceAssetIds[0];
    const items =
      target === "batch" ? snapshot.items : snapshot.items.filter((item) => item.id === target);
    if (!original || !items.length) throw new Error("分镜资料不完整，请重新规划");
    const previous = shots.find((shot) => shot.id === target)?.completedReplacement;
    save({ imageTarget: target });
    const result = await generation.mutateAsync({
      model: imageModel,
      source,
      draft: {
        prompt: current().description.slice(0, 600),
        references: [originalReference(original)],
        ratio: "9:16",
        resolution,
        count: String(items.length),
        quality: "标准",
      },
      variation: { version: 1, planId: snapshot.id, items },
    });
    if (target === "batch") save({ batchId: result.id, imageTarget: undefined });
    else
      save({
        replacements: {
          ...current().progress.replacements,
          [target]: previous && previous !== result.id ? [previous, result.id] : [result.id],
        },
        imageTarget: undefined,
      });
  }

  const action = useMutation({
    retry: false,
    mutationKey: ["tk-storyboard-action", scope],
    mutationFn: async (action: "plan" | "video" | { shot: string }) => {
      if (!owner) throw new Error("请先登录");
      assertCurrentOwner();
      if (action === "video") {
        if (video.hasPending) {
          await video.submitAsync({
            input: { prompt: "", seconds: draft.seconds, aspectRatio: "9:16" },
            references: [],
            clearDraft: false,
          });
          update({ showPanel: false });
          revealNewestHistory();
          return;
        }
        const originalAssetId = plan?.referenceAssetIds[0];
        if (
          !originalAssetId ||
          !selected.length ||
          selected.length > storyboardVideoShotLimit ||
          selected.some((shot) => !shot.image || shot.pending || shot.uncertain)
        )
          throw new Error("请选好已生成的分镜图");
        const input: StoryboardRequest = {
          stage: "video",
          description: draft.description,
          seconds: draft.seconds,
          originalAssetId,
          shots: selected.flatMap((shot) =>
            shot.image
              ? [
                  {
                    assetId: shot.image,
                    title: shot.title,
                    prompt: shot.prompt.slice(0, 250),
                  },
                ]
              : [],
          ),
        };
        const previous = progress.optimization;
        const attempt =
          previous && JSON.stringify(previous.input) === JSON.stringify(input)
            ? previous
            : { key: crypto.randomUUID(), input };
        save({ optimization: attempt });
        let prompt = "prompt" in attempt ? attempt.prompt : undefined;
        if (!prompt) {
          let optimized: VariationPlan;
          try {
            optimized = await requestPlan(attempt);
          } catch (error) {
            if (definitive(error)) save({ optimization: undefined });
            throw error;
          }
          if (optimized.status === "running") throw new Error("提示词正在优化，请稍后继续");
          prompt = optimized.status === "ready" ? optimized.items[0]?.prompt : undefined;
          if (!prompt) {
            save({ optimization: undefined });
            throw new Error("提示词优化未完成，请稍后重试");
          }
          save({ optimization: { ...attempt, prompt } });
        }
        assertCurrentOwner();
        await video.submitAsync({
          input: { prompt, seconds: input.seconds, aspectRatio: "9:16" },
          references: [originalAssetId, ...input.shots.map((shot) => shot.assetId)].map(
            originalReference,
          ),
          clearDraft: false,
        });
        update({ showPanel: false });
        revealNewestHistory();
        return;
      }
      let snapshot = plan;
      if (!snapshot && progress.planId) snapshot = await readPlan(progress.planId);
      if (!snapshot) {
        let attempt = current().progress.planAttempt;
        if (!attempt) {
          const [original] = await uploadImageReferences(client, owner, draft.references);
          if (!original) throw new Error("请上传商品原图");
          attempt = {
            key: crypto.randomUUID(),
            input: {
              stage: "plan",
              description: draft.description.trim(),
              seconds: draft.seconds,
              count: draft.count,
              originalAssetId: original,
            },
          };
          update({ references: [originalReference(original)] });
          save({ planAttempt: attempt });
        }
        try {
          snapshot = await requestPlan(attempt);
        } catch (error) {
          if (definitive(error)) save({ planAttempt: undefined });
          throw error;
        }
        if (snapshot.status === "running") throw new Error("分镜仍在分析，请稍后继续");
        if (snapshot.status !== "ready" || !snapshot.items.length) {
          save({ planAttempt: undefined });
          throw new Error("分镜分析未完成，请稍后重试");
        }
        client.setQueryData(planKey(snapshot.id), snapshot);
        save({
          planId: snapshot.id,
          planAttempt: undefined,
          order: snapshot.items.map((item) => item.id),
          excluded: snapshot.items.slice(storyboardVideoShotLimit).map((item) => item.id),
        });
      }
      const target = ownImagePending
        ? progress.imageTarget
        : action === "plan"
          ? "batch"
          : action.shot;
      if (!target) throw new Error("请在原分镜确认上次出图");
      await submitImages(snapshot, target);
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  useErrorToast(action.error?.message ?? planQuery.error?.message);
  const busy = action.isPending || generation.isPending || video.isPending;
  const start = (next: Parameters<typeof action.mutate>[0]) => {
    if (lock.current || busy || !scope) return;
    lock.current = true;
    if (next !== "video") {
      update({ showPanel: true });
      onReview();
    }
    action.mutate(next);
  };
  return {
    draft,
    plan,
    shots,
    selected,
    busy,
    scope,
    pendingImage,
    ownImagePending,
    action: action.isPending ? action.variables : undefined,
    planConfigured: capabilities.data?.enabled === true,
    canDraw,
    canVideo: videoModel.data?.enabled === true,
    pendingVideo: video.hasPending,
    blockedVideo: video.blockedByPending,
    jobError: jobs.some((job) => job.isError),
    refreshJobs: () => {
      for (const job of jobs) if (job.isError) void job.refetch();
    },
    update,
    save,
    start,
    reset: () => useStoryboardState.getState().reset(scope),
    review: () => {
      update({ showPanel: true });
      onReview();
    },
  };
}
