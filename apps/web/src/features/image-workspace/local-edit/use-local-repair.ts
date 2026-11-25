import { imageJobSchema, latestImageEditResponseSchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { currentMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import {
  assetContentUrl,
  imageRequest,
  pendingSubmissionSource,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "../../generation/generation-client";
import { modelCapabilities, supportsReferences } from "../../generation/models/model-capabilities";
import type { PreviewImage } from "../image-preview";
import { imageWorkspaceMessages } from "../image-workspace-messages";
import {
  emptyRepairDraft,
  type RepairRegion,
  repairDraftKey,
  repairOutput,
  repairPrompt,
  useRepairDrafts,
} from "./local-repair-state";

const repairModel = "gpt-image-2.5";

/** 管理局部编辑选区，并用专用模型提交新任务。 */
export function useLocalRepair(source: PreviewImage, initialTool = "select") {
  const { image, imageError } = useRepairImage(source.id);
  const {
    key,
    draft,
    update,
    models,
    generate,
    pending,
    ownPending,
    selected,
    setSelected,
    job,
    result,
    busy,
    locked,
    inputsReady,
  } = useRepairTasks(source.id, imageError);
  const [tool, setTool] = useState(initialTool);
  const width = source.width ?? image?.naturalWidth ?? 1;
  const height = source.height ?? image?.naturalHeight ?? 1;
  const output = repairOutput(width, height);
  const capabilities = modelCapabilities(models.data, repairModel, "local-edit");
  // 待确认任务重放已保存的请求，不受新任务的模型能力限制。
  const available =
    inputsReady &&
    (ownPending ||
      (supportsReferences(capabilities, 1) &&
        !!capabilities?.enabledResolutions.includes(output.resolution)));
  // 新任务至少需要一个选区，且每个选区都要填写修改说明。
  const canGenerate =
    ownPending ||
    (draft.regions.length > 0 && draft.regions.every((region) => region.prompt.trim().length > 0));
  const { change, undo, redo, resetHistory, canUndo, canRedo } = useRepairHistory(
    draft.regions,
    locked,
    (patch) => update(key, patch),
  );
  const select = (id: string) => {
    setSelected(id);
    if (window.matchMedia("(min-width: 768px)").matches)
      document.getElementById(`repair-region-${id}`)?.scrollIntoView({ block: "nearest" });
  };
  const add = () => {
    const region = defaultRepairRegion(width, height);
    change([...draft.regions, region]);
    setSelected(region.id);
    setTool("select");
  };
  const submit = useRepairSubmission({
    ready:
      !generate.isPending &&
      !busy &&
      !!available &&
      !!image &&
      (!pending || ownPending) &&
      canGenerate,
    ownPending,
    generate,
    assetId: source.id,
    regions: draft.regions,
    width,
    height,
    output,
    onAccepted: (jobId) => {
      update(key, { regions: [], jobId });
      setSelected(null);
      resetHistory();
    },
  });
  return {
    draft,
    image,
    width,
    height,
    output,
    models,
    available,
    busy,
    locked,
    pending,
    ownPending,
    canGenerate,
    job,
    result,
    generate,
    selected,
    setSelected,
    tool,
    setTool,
    change,
    select,
    add,
    submit,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
export type LocalRepairEditor = ReturnType<typeof useLocalRepair>;

function useRepairImage(assetId: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  useEffect(() => {
    const loaded = new window.Image();
    loaded.crossOrigin = "anonymous";
    loaded.referrerPolicy = "strict-origin-when-cross-origin";
    loaded.onload = () => setImage(loaded);
    loaded.onerror = () => setImageError(currentMessages(imageWorkspaceMessages).imageLoadFailed);
    loaded.src = assetContentUrl(assetId);
    return () => {
      loaded.onload = null;
      loaded.onerror = null;
      loaded.src = "";
    };
  }, [assetId]);
  return { image, imageError };
}

function useRepairHistory(
  regionsBefore: RepairRegion[],
  locked: boolean,
  update: (patch: { regions: RepairRegion[] }) => void,
) {
  const [history, setHistory] = useState<{ past: RepairRegion[][]; future: RepairRegion[][] }>({
    past: [],
    future: [],
  });
  const change = (regions: RepairRegion[]) => {
    setHistory((state) => ({ past: [...state.past.slice(-29), regionsBefore], future: [] }));
    update({ regions });
  };
  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous || locked) return;
    setHistory({ past: history.past.slice(0, -1), future: [regionsBefore, ...history.future] });
    update({ regions: previous });
  };
  const redo = () => {
    const next = history.future[0];
    if (!next || locked) return;
    setHistory({ past: [...history.past, regionsBefore], future: history.future.slice(1) });
    update({ regions: next });
  };
  return {
    change,
    undo,
    redo,
    resetHistory: () => setHistory({ past: [], future: [] }),
    canUndo: !locked && history.past.length > 0,
    canRedo: !locked && history.future.length > 0,
  };
}

function useRepairSubmission({
  ready,
  ownPending,
  generate,
  assetId,
  regions,
  width,
  height,
  output,
  onAccepted,
}: {
  ready: boolean;
  ownPending: boolean;
  generate: ReturnType<typeof useGenerateImage>;
  assetId: string;
  regions: RepairRegion[];
  width: number;
  height: number;
  output: ReturnType<typeof repairOutput>;
  onAccepted: (jobId: string) => void;
}) {
  const submissionLock = useRef(false);
  return async () => {
    if (submissionLock.current || !ready) return false;
    const prompt = repairPrompt(regions, width, height);
    if (!ownPending && prompt.length > 9000) return false;
    submissionLock.current = true;
    try {
      const submitted = await generate.mutateAsync({
        model: repairModel,
        source: `repair:${assetId}`,
        localEdit: { sourceAssetId: assetId, width, height, regions: regions },
        draft: {
          prompt,
          references: [
            {
              id: assetId,
              assetId: assetId,
              name: currentMessages(imageWorkspaceMessages).original,
              src: assetContentUrl(assetId),
            },
          ],
          ratio: output.ratio,
          resolution: output.resolution,
          quality: "medium",
          count: "1",
        },
      });
      onAccepted(submitted.id);
      return true;
    } catch {
      /* 共享的错误提示与待提交记录会保留这次付费请求的原样，这里不再重复处理。 */
      return false;
    } finally {
      submissionLock.current = false;
    }
  };
}

function defaultRepairRegion(width: number, height: number): RepairRegion {
  return {
    id: crypto.randomUUID(),
    x: width * 0.3,
    y: height * 0.3,
    width: width * 0.3,
    height: height * 0.3,
    prompt: "",
  };
}

function useRepairTasks(assetId: string, imageError: string | null) {
  const session = useImageSession();
  const key = repairDraftKey(session.data, assetId);
  const localDraft = useRepairDrafts((state) => state.drafts[key]);
  const draft = localDraft ?? emptyRepairDraft;
  const update = useRepairDrafts((state) => state.update);
  const models = useImageModels();
  const generate = useGenerateImage({ successFeedback: "button" });
  const pending = usePendingSubmission(session.data);
  const ownPending =
    !!session.data && pending && pendingSubmissionSource(session.data) === `repair:${assetId}`;
  const [selected, setSelected] = useState<string | null>(draft.regions[0]?.id ?? null);
  const latest = useQuery({
    queryKey: ["image-latest-edit", key],
    enabled: session.isSuccess,
    retry: false,
    queryFn: async ({ signal }) =>
      latestImageEditResponseSchema.parse(
        await (await imageRequest(`image-assets/${assetId}/latest-edit`, { signal })).json(),
      ),
  });
  useEffect(() => {
    const saved = latest.data?.job;
    const edit = saved?.input?.localEdit;
    if (!saved || !edit || localDraft || useRepairDrafts.getState().drafts[key]) return;
    // 已提交的任务只恢复为历史记录，编辑区从空白草稿开始。
    update(key, { regions: [], jobId: saved.id });
    setSelected(null);
  }, [latest.data, key, update, localDraft]);
  const job = useQuery({
    queryKey: ["image-task", draft.jobId],
    enabled: !!draft.jobId && session.isSuccess,
    retry: false,
    queryFn: async ({ signal }) =>
      imageJobSchema.parse(
        await (await imageRequest(`image-tasks/${draft.jobId}`, { signal })).json(),
      ),
  });
  useErrorToast(
    latest.error?.message ??
      generate.feedbackError?.message ??
      job.error?.message ??
      models.error?.message ??
      imageError,
  );
  const busy = !!draft.jobId && (!job.data || ["queued", "running"].includes(job.data.status));
  const restoring = !localDraft && !latest.isSuccess;
  const locked = !session.isSuccess || restoring || generate.isPending || busy || pending;
  const result = job.data?.items.find(
    (item) => item.status === "succeeded" && item.output_asset_id,
  );
  const inputsReady = session.isSuccess && (!!localDraft || latest.isSuccess);
  return {
    key,
    draft,
    update,
    models,
    generate,
    pending,
    ownPending,
    selected,
    setSelected,
    job,
    result,
    busy,
    locked,
    inputsReady,
  };
}
