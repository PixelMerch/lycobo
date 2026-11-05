import {
  type ImageJob,
  type StoryboardRequest,
  storyboardRequestSchema,
  storyboardVideoShotLimit,
  type VariationPlan,
  variationPlanSchema,
  videoReferenceLimit,
} from "@lycoboai/contracts";
import type { QueryClient } from "@tanstack/react-query";
import type { useEnterpriseSession } from "../../auth/auth-client";
import {
  ImageApiError,
  imageRequest,
  uploadImageReferences,
  type useGenerateImage,
} from "../../generation/generation-client";
import type { Draft } from "../../generation/studio-state";
import { type emptyStoryboard, originalReference } from "./storyboard-state";

export const source = "tk-storyboard";
export const modelId = "gpt-image-2.5";
export const resolution = "1.5K";
export const isRunning = (status: string) => status === "queued" || status === "running";
/** Anything saved here is durable work a failed attempt can resume instead of starting over. */
export const hasStarted = (progress: typeof emptyStoryboard.progress) =>
  !!(progress.planAttempt || progress.planId || progress.batchId);
const definitive = (error: unknown) =>
  error instanceof ImageApiError && [400, 401, 403, 409, 413, 429].includes(error.status);

type StoryboardDraft = typeof emptyStoryboard;
type Progress = StoryboardDraft["progress"];
type CurrentDraft = () => StoryboardDraft;
type SaveProgress = (patch: Partial<Progress>) => void;
type ReadJob = (id: string) => Promise<ImageJob>;
type PlanRequest = (attempt: { key: string; input: StoryboardRequest }) => Promise<VariationPlan>;
type Generation = ReturnType<typeof useGenerateImage>;
type Owner = NonNullable<ReturnType<typeof useEnterpriseSession>["data"]>;
type PreparePlan = {
  current: CurrentDraft;
  update: (patch: Partial<StoryboardDraft>) => void;
  save: SaveProgress;
  assertOwner: () => void;
  client: QueryClient;
  owner: Owner;
};

async function preparePlanAttempt({
  current,
  update,
  save,
  assertOwner,
  client,
  owner,
}: PreparePlan) {
  let attempt = current().progress.planAttempt;
  if (!attempt) {
    assertOwner();
    const [originalAssetId, ...additionalOriginalAssetIds] = await uploadImageReferences(
      client,
      owner,
      current().references,
    );
    if (!originalAssetId) throw new Error("请上传商品图片");
    attempt = {
      key: crypto.randomUUID(),
      input: {
        stage: "plan",
        description: current().description.trim(),
        originalAssetId,
        ...(additionalOriginalAssetIds.length ? { additionalOriginalAssetIds } : {}),
        count: current().count,
        seconds: current().seconds,
      },
    };
    update({
      references: [originalAssetId, ...additionalOriginalAssetIds].map(originalReference),
    });
    save({ planAttempt: attempt });
  }
  return attempt;
}

export async function prepareStoryboardPlan({
  current,
  update,
  save,
  assertOwner,
  planRequest,
  client,
  owner,
}: PreparePlan & { planRequest: PlanRequest }) {
  let snapshot: VariationPlan;
  const planId = current().progress.planId;
  if (planId) {
    snapshot = variationPlanSchema.parse(
      await (await imageRequest(`variation-plans/${planId}`)).json(),
    );
  } else {
    const attempt = await preparePlanAttempt({ current, update, save, assertOwner, client, owner });
    try {
      snapshot = await planRequest(attempt);
    } catch (error) {
      if (definitive(error)) save({ planAttempt: undefined });
      throw error;
    }
    if (snapshot.status === "running") throw new Error("正在准备画面，请稍后继续");
    if (snapshot.status !== "ready" || snapshot.items.length !== current().count) {
      save({ planAttempt: undefined });
      throw new Error("画面方案未完成，请稍后重试");
    }
    save({ planId: snapshot.id, planAttempt: undefined });
  }
  return snapshot;
}

async function retryStoryboardFrame(
  batchId: string | undefined,
  retryPosition: number | undefined,
  ownImagePending: boolean,
  readImageJob: ReadJob,
  assertOwner: () => void,
  generation: Generation,
  save: SaveProgress,
  imageDraft: Draft,
) {
  if (batchId && retryPosition !== undefined && !ownImagePending) {
    const job = await readImageJob(batchId);
    const item = job.items.find(
      ({ position, status }) => position === retryPosition && status === "failed",
    );
    if (item && !isRunning(job.status)) {
      assertOwner();
      await generation.mutateAsync({
        model: modelId,
        source,
        draft: imageDraft,
        retryJobId: batchId,
        retryItemId: item.id,
      });
      save({ frameJobStatus: "queued", failedFramePositions: undefined });
    }
  }
}

export async function submitStoryboardFrames({
  current,
  save,
  assertOwner,
  readImageJob,
  generation,
  configured,
  ownImagePending,
  snapshot,
  originalAssetIds,
  retryPosition,
}: {
  current: CurrentDraft;
  save: SaveProgress;
  assertOwner: () => void;
  readImageJob: ReadJob;
  generation: Generation;
  configured: boolean;
  ownImagePending: boolean;
  snapshot: VariationPlan;
  originalAssetIds: string[];
  retryPosition: number | undefined;
}) {
  let batchId = current().progress.batchId;
  const imageDraft = {
    prompt: current().description.slice(0, 600),
    references: originalAssetIds.map(originalReference),
    ratio: "9:16" as const,
    resolution,
    count: String(snapshot.items.length),
    quality: "标准" as const,
  };
  await retryStoryboardFrame(
    batchId,
    retryPosition,
    ownImagePending,
    readImageJob,
    assertOwner,
    generation,
    save,
    imageDraft,
  );
  if (!batchId || ownImagePending) {
    assertOwner();
    if (!ownImagePending && !configured) throw new Error("画面生成服务暂时不可用");
    const target = ownImagePending ? current().progress.imageTarget : "batch";
    const items =
      target === "batch" || !target
        ? snapshot.items
        : snapshot.items.filter(({ id }) => id === target);
    save({ imageTarget: target ?? "batch" });
    const batch = await generation.mutateAsync({
      model: modelId,
      source,
      draft: { ...imageDraft, count: String(items.length) },
      variation: { version: 1, planId: snapshot.id, items },
    });
    batchId ??= batch.id;
    save({ batchId, imageTarget: undefined });
  }
  return batchId;
}

function frameProgressChanged(
  previous: Progress,
  frames: NonNullable<Progress["frames"]>,
  status: ImageJob["status"],
  failedFramePositions: number[],
) {
  return (
    frames.length !== (previous.frames?.length ?? 0) ||
    frames.some((frame, index) => frame.assetId !== previous.frames?.[index]?.assetId) ||
    status !== previous.frameJobStatus ||
    failedFramePositions.join() !== previous.failedFramePositions?.join()
  );
}

function completedShots(job: ImageJob, plan: VariationPlan, originalAssetIds: string[]) {
  const seen = new Set(originalAssetIds);
  return [...job.items]
    .sort((a, b) => a.position - b.position)
    .flatMap(({ position, status, output_asset_id: assetId }) => {
      const shot = plan.items[position];
      if (!shot || status !== "succeeded" || !assetId || seen.has(assetId)) return [];
      seen.add(assetId);
      return [{ position, assetId, title: shot.title, prompt: shot.prompt.slice(0, 250) }];
    })
    .slice(0, Math.min(storyboardVideoShotLimit, videoReferenceLimit - originalAssetIds.length));
}

export async function waitForImages(
  id: string,
  plan: VariationPlan,
  originalAssetIds: string[],
  readImageJob: ReadJob,
  current: CurrentDraft,
  save: SaveProgress,
) {
  const deadline = Date.now() + 8 * 60_000;
  while (Date.now() < deadline) {
    const job = await readImageJob(id);
    const ready = !isRunning(job.status);
    const shots = completedShots(job, plan, originalAssetIds);
    const frames = shots.map(({ position, assetId, title }) => ({ position, assetId, title }));
    const failedFramePositions = job.items
      .filter(({ status }) => status === "failed")
      .map(({ position }) => position);
    const previous = current().progress;
    if (frameProgressChanged(previous, frames, job.status, failedFramePositions)) {
      save({ frames, frameJobStatus: job.status, failedFramePositions });
    }
    if (ready) return shots;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("画面仍在制作，请稍后点击继续生成");
}

export async function prepareVideoPrompt({
  current,
  save,
  planRequest,
  originalAssetId,
  additionalOriginalAssetIds,
  shots,
}: {
  current: CurrentDraft;
  save: SaveProgress;
  planRequest: PlanRequest;
  originalAssetId: string;
  additionalOriginalAssetIds: string[];
  shots: { assetId: string; title: string; prompt: string }[];
}) {
  const optimization = storyboardRequestSchema.parse({
    stage: "video",
    description: current().description,
    originalAssetId,
    ...(additionalOriginalAssetIds.length ? { additionalOriginalAssetIds } : {}),
    seconds: current().seconds,
    shots,
  });
  const prior = current().progress.optimization;
  const attempt =
    prior && JSON.stringify(prior.input) === JSON.stringify(optimization)
      ? prior
      : { key: crypto.randomUUID(), input: optimization, prompt: undefined };
  save({ optimization: attempt });
  let prompt = attempt.prompt;
  if (!prompt) {
    let optimized: VariationPlan;
    try {
      optimized = await planRequest(attempt);
    } catch (error) {
      if (definitive(error)) save({ optimization: undefined });
      throw error;
    }
    if (optimized.status === "running") throw new Error("正在编写视频提示词，请稍后继续");
    prompt = optimized.status === "ready" ? optimized.items[0]?.prompt : undefined;
    if (!prompt) {
      save({ optimization: undefined });
      throw new Error("视频提示词未完成，请稍后继续");
    }
    save({ optimization: { ...attempt, prompt } });
  }
  return { prompt, optimization };
}
