import {
  Button,
  FieldError,
  Input,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { imageJobSchema } from "@lycoboai/contracts";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowLeft,
  IconHandStop,
  IconMinus,
  IconPlus,
  IconPointer,
  IconRectangle,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
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
  constrainRegion,
  emptyRepairDraft,
  type RepairRegion,
  repairOutput,
  repairPrompt,
  useRepairDrafts,
} from "./local-repair-state";
import { RepairCanvas } from "./repair-canvas";
import { isModelId } from "./studio-state";
import "./local-repair.css";

export default function LocalRepair({
  source,
  meta,
  onBack,
  onPreview,
}: {
  source: PreviewImage;
  meta: PreviewMeta;
  onBack: () => void;
  onPreview: (image: PreviewImage) => void;
}) {
  const session = useImageSession();
  const key = `${session.data?.organizationId}:${session.data?.userId}:${source.id}`;
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
  const [tool, setTool] = useState("rect");
  const [zoom, setZoom] = useState(100);
  const [fitVersion, setFitVersion] = useState(0);
  const [attempted, setAttempted] = useState(false);
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
    models.data?.enabled &&
    models.data.editsEnabled &&
    models.data.models.some(
      (entry) => entry.id === model && entry.enabledResolutions.includes(output.resolution),
    );
  const busy = !!draft.jobId && (!job.data || ["queued", "running"].includes(job.data.status));
  const locked = generate.isPending || busy || pending;
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
      (pending && !ownPending)
    )
      return;
    setAttempted(true);
    if (
      !ownPending &&
      (!draft.regions.length || draft.regions.some((region) => !region.prompt.trim()))
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
  return (
    <>
      <section className="image-preview-stage repair-stage" aria-label="局部修复">
        <div className="repair-topbar">
          <Button variant="ghost" size="sm" onPress={onBack}>
            <UiIcon icon={IconArrowLeft} />
            返回详情
          </Button>
          <span>局部修复</span>
        </div>
        <div className="repair-toolbar">
          <ToggleButtonGroup
            size="sm"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[tool]}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0];
              if (next) setTool(String(next));
            }}
            aria-label="画布工具"
          >
            <ToggleButton id="select" isIconOnly aria-label="选择区域">
              <UiIcon icon={IconPointer} />
            </ToggleButton>
            <ToggleButton id="rect" isIconOnly aria-label="框选区域">
              <UiIcon icon={IconRectangle} />
            </ToggleButton>
            <ToggleButton id="hand" isIconOnly aria-label="拖动画布">
              <UiIcon icon={IconHandStop} />
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            aria-label="撤销区域修改"
            isDisabled={locked || !history.past.length}
            onPress={() => {
              const previous = history.past.at(-1);
              if (!previous) return;
              setHistory({
                past: history.past.slice(0, -1),
                future: [draft.regions, ...history.future],
              });
              update(key, { regions: previous });
            }}
          >
            <UiIcon icon={IconArrowBackUp} />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="ghost"
            aria-label="重做区域修改"
            isDisabled={locked || !history.future.length}
            onPress={() => {
              const next = history.future[0];
              if (!next) return;
              setHistory({
                past: [...history.past, draft.regions],
                future: history.future.slice(1),
              });
              update(key, { regions: next });
            }}
          >
            <UiIcon icon={IconArrowForwardUp} />
          </Button>
        </div>
        {image && (
          <RepairCanvas
            key={fitVersion}
            image={image}
            width={width}
            height={height}
            regions={draft.regions}
            selected={selected}
            tool={tool}
            zoom={zoom}
            disabled={locked}
            onSelect={select}
            onChange={change}
            onZoom={setZoom}
          />
        )}
        <p className="repair-canvas-hint">拖动框选 · 滚轮缩放 · 按住空格拖动画布</p>
      </section>
      <aside className="image-preview-info repair-info" aria-label="局部修复设置">
        <div className="image-preview-close-row">
          <DialogClose label="关闭图片预览" className="image-preview-close" />
        </div>
        <header>
          <h2>局部修复</h2>
          <p>框选需要修改的位置，分别描述修改内容</p>
        </header>
        <div className="repair-source">
          <img src={assetContentUrl(source.id, true)} alt="当前原图" />
          <span>
            当前图片<small>{source.publicId ?? "原图"}</small>
          </span>
        </div>
        <h3>
          修改区域 <span>（{draft.regions.length}/8）</span>
        </h3>
        <div className="repair-regions">
          {draft.regions.map((region, index) => (
            <section
              className="repair-region-card"
              id={`repair-region-${region.id}`}
              key={region.id}
              data-selected={selected === region.id}
            >
              <div className="repair-region-heading">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`区域 ${index + 1}`}
                  onPress={() => setSelected(region.id)}
                >
                  <span className="repair-badge">{index + 1}</span>区域 {index + 1}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`删除区域 ${index + 1}`}
                  isDisabled={locked}
                  onPress={() => change(draft.regions.filter((value) => value.id !== region.id))}
                >
                  <UiIcon icon={IconTrash} />
                </Button>
              </div>
              <TextField
                aria-label={`区域 ${index + 1} 修改说明`}
                value={region.prompt}
                isDisabled={locked}
                isInvalid={attempted && !region.prompt.trim()}
                onFocus={() => setSelected(region.id)}
                onChange={(prompt) =>
                  change(
                    draft.regions.map((value) =>
                      value.id === region.id ? { ...value, prompt } : value,
                    ),
                  )
                }
              >
                <TextArea rows={3} maxLength={900} placeholder="描述这个区域需要怎么修改…" />
                <FieldError>请填写这个区域的修改说明</FieldError>
              </TextField>
              {selected === region.id && (
                <div className="repair-coordinates">
                  {(["x", "y", "width", "height"] as const).map((axis) => (
                    <TextField
                      key={axis}
                      aria-label={`区域 ${index + 1} ${{ x: "左", y: "上", width: "宽", height: "高" }[axis]}`}
                      isDisabled={locked}
                      value={String(Math.round(region[axis]))}
                      onChange={(value) => {
                        if (value === "" || !Number.isFinite(Number(value))) return;
                        change(
                          draft.regions.map((item) =>
                            item.id === region.id
                              ? constrainRegion({ ...item, [axis]: Number(value) }, width, height)
                              : item,
                          ),
                        );
                      }}
                    >
                      <span aria-hidden="true">
                        {{ x: "左", y: "上", width: "宽", height: "高" }[axis]}
                      </span>
                      <Input
                        type="number"
                        aria-label={`区域 ${index + 1} ${{ x: "左", y: "上", width: "宽", height: "高" }[axis]}`}
                      />
                    </TextField>
                  ))}
                </div>
              )}
            </section>
          ))}
          <Button
            fullWidth
            variant="outline"
            size="sm"
            isDisabled={locked || !image || draft.regions.length >= 8}
            onPress={add}
          >
            <UiIcon icon={IconPlus} />
            添加区域
          </Button>
          {!draft.regions.length && <p>在图片上拖动框选，或点击添加区域。</p>}
        </div>
        <div className="repair-submit">
          <p>尽量保留选区外内容，实际效果以生成结果为准。</p>
          <div className="repair-output">
            <span>输出</span>
            <span>
              1 张 · {output.resolution} · {output.ratio}
            </span>
          </div>
          <small>
            {model} · {models.data?.unitCredits ?? 20} 币
          </small>
          {!available && models.isSuccess && <p>当前模型暂不支持此规格的图片编辑。</p>}
          {pending && !ownPending && <p>请先在原提交入口确认上次提交。</p>}
          {attempted && !draft.regions.length && <p>请先添加需要修改的区域。</p>}
          {job.data && (
            <p aria-live="polite">
              {result
                ? "修改版已生成"
                : ["queued", "running"].includes(job.data.status)
                  ? "修改版生成中，可返回详情继续查看图片。"
                  : "修改版未能完成，请在历史记录查看任务与积分状态。"}
            </p>
          )}
          <Button
            fullWidth
            variant="primary"
            className="repair-generate"
            isPending={generate.isPending}
            isDisabled={!available || !image || busy || (pending && !ownPending)}
            onPress={() => void submit()}
          >
            {ownPending ? "确认上次提交" : busy ? "修改版生成中…" : "生成修改版"}
          </Button>
          {result?.output_asset_id && (
            <Button
              variant="secondary"
              fullWidth
              onPress={() => {
                if (!result.output_asset_id || !job.data) return;
                onPreview({
                  id: result.output_asset_id,
                  publicId: result.output_public_id,
                  width: result.width,
                  height: result.height,
                  meta: {
                    model: job.data.model,
                    prompt: job.data.prompt,
                    createdAt: job.data.created_at,
                    references: [source.id],
                  },
                });
              }}
            >
              查看修改版
            </Button>
          )}
          <small>生成新版本，保留原图</small>
        </div>
      </aside>
      <footer className="image-preview-bar repair-bar">
        <span>
          {width} × {height}
        </span>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label="缩小画布"
          onPress={() => setZoom(Math.max(25, zoom - 10))}
        >
          <UiIcon icon={IconMinus} />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            setZoom(100);
            setFitVersion((value) => value + 1);
          }}
        >
          适应画布
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label="放大画布"
          onPress={() => setZoom(Math.min(500, zoom + 10))}
        >
          <UiIcon icon={IconPlus} />
        </Button>
        <output aria-label="画布缩放比例">{zoom}%</output>
      </footer>
    </>
  );
}
