import { imageJobSchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useErrorToast } from "../../lib/error-toast";
import {
  assetContentUrl,
  imageRequest,
  pendingSubmissionSource,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "./generation-client";
import type { PreviewImage, PreviewMeta } from "./image-preview";
import {
  emptyRepairDraft,
  type RepairRegion,
  repairDraftKey,
  repairOutput,
  repairPrompt,
  useRepairDrafts,
} from "./local-repair-state";
import { isModelId } from "./studio-state";

export function useLocalRepair(source: PreviewImage, meta: PreviewMeta, initialTool = "select") {
  const session = useImageSession();
  const key = repairDraftKey(session.data, source.id);
  const draft = useRepairDrafts((state) => state.drafts[key] ?? emptyRepairDraft);
  const update = useRepairDrafts((state) => state.update);
  const models = useImageModels();
  const generate = useGenerateImage();
  const pending = usePendingSubmission(session.data);
  const ownPending =
    !!session.data && pending && pendingSubmissionSource(session.data) === `repair:${source.id}`;
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(draft.regions[0]?.id ?? null);
  const [tool, setTool] = useState(initialTool);
  const [history, setHistory] = useState<{ past: RepairRegion[][]; future: RepairRegion[][] }>({
    past: [],
    future: [],
  });
  const submissionLock = useRef(false);
  const job = useQuery({
    queryKey: ["image-repair-task", key, draft.jobId],
    enabled: !!draft.jobId && session.isSuccess,
    retry: false,
    queryFn: async ({ signal }) =>
      imageJobSchema.parse(
        await (await imageRequest(`image-tasks/${draft.jobId}`, { signal })).json(),
      ),
    refetchInterval: (query) =>
      !query.state.error &&
      (!query.state.data || ["queued", "running"].includes(query.state.data.status))
        ? 3000
        : false,
  });
  useErrorToast(
    generate.error?.message ?? job.error?.message ?? models.error?.message ?? imageError,
  );
  useEffect(() => {
    const loaded = new window.Image();
    loaded.onload = () => setImage(loaded);
    loaded.onerror = () => setImageError("原图加载失败，请重新打开图片后再试。");
    loaded.src = assetContentUrl(source.id);
    return () => {
      loaded.onload = null;
      loaded.onerror = null;
      loaded.src = "";
    };
  }, [source.id]);
  const width = image?.naturalWidth ?? source.width ?? 1;
  const height = image?.naturalHeight ?? source.height ?? 1;
  const output = repairOutput(width, height);
  const model = isModelId(meta.model) ? meta.model : "gpt-image-2";
  const available =
    session.isSuccess &&
    models.data?.enabled &&
    models.data.editsEnabled &&
    models.data.models.some(
      (entry) => entry.id === model && entry.enabledResolutions.includes(output.resolution),
    );
  const busy = !!draft.jobId && (!job.data || ["queued", "running"].includes(job.data.status));
  const locked = !session.isSuccess || generate.isPending || busy || pending;
  /* The button carries readiness: at least one region, each with a description.
   * That replaces a separate validation message and a click that goes nowhere. */
  const canGenerate =
    ownPending ||
    (draft.regions.length > 0 && draft.regions.every((region) => region.prompt.trim().length > 0));
  const result = job.data?.items.find(
    (item) => item.status === "succeeded" && item.output_asset_id,
  );
  const change = (regions: RepairRegion[]) => {
    setHistory((state) => ({ past: [...state.past.slice(-29), draft.regions], future: [] }));
    update(key, { regions });
  };
  const select = (id: string) => {
    setSelected(id);
    if (window.matchMedia("(min-width: 768px)").matches)
      document.getElementById(`repair-region-${id}`)?.scrollIntoView({ block: "nearest" });
  };
  const add = () => {
    const region = {
      id: crypto.randomUUID(),
      x: width * 0.3,
      y: height * 0.3,
      width: width * 0.3,
      height: height * 0.3,
      prompt: "",
    };
    change([...draft.regions, region]);
    setSelected(region.id);
    setTool("select");
  };
  const submit = async () => {
    if (
      submissionLock.current ||
      generate.isPending ||
      busy ||
      !available ||
      !image ||
      (pending && !ownPending) ||
      !canGenerate
    )
      return;
    const prompt = repairPrompt(draft.regions, width, height);
    if (!ownPending && prompt.length > 9000) return;
    submissionLock.current = true;
    try {
      const submitted = await generate.mutateAsync({
        model,
        source: `repair:${source.id}`,
        draft: {
          prompt,
          references: [
            { id: source.id, assetId: source.id, name: "原图", src: assetContentUrl(source.id) },
          ],
          ratio: output.ratio,
          resolution: output.resolution,
          quality: "标准",
          count: "1",
        },
      });
      update(key, { jobId: submitted.id });
    } catch {
      /* The shared error toast and pending submission retain the exact paid request. */
    } finally {
      submissionLock.current = false;
    }
  };
  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous || locked) return;
    setHistory({ past: history.past.slice(0, -1), future: [draft.regions, ...history.future] });
    update(key, { regions: previous });
  };
  const redo = () => {
    const next = history.future[0];
    if (!next || locked) return;
    setHistory({ past: [...history.past, draft.regions], future: history.future.slice(1) });
    update(key, { regions: next });
  };
  return {
    draft,
    image,
    width,
    height,
    output,
    model,
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
    canUndo: !locked && history.past.length > 0,
    canRedo: !locked && history.future.length > 0,
  };
}
export type LocalRepairEditor = ReturnType<typeof useLocalRepair>;
