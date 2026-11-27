import { Button, TextArea, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import {
  IconArrowDown,
  IconArrowForwardUp,
  IconArrowUp,
  IconCopy,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { DataSkeleton } from "../../components/data-skeleton";
import { UiIcon } from "../../components/ui-icon";
import { useLocale } from "../../i18n/locale-store";
import { currentMessages, useMessages } from "../../i18n/messages";
import { useErrorToast } from "../../lib/error-toast";
import { assetContentUrl, rememberImageDeliveries } from "../generation/asset-delivery-client";
import {
  ImageApiError,
  imageRequest,
  useGenerateImage,
  useImageModels,
  useImageSession,
} from "../generation/generation-client";
import { generationMessages } from "../generation/generation-messages";
import { modelCapabilities } from "../generation/models/model-capabilities";
import { modelDisplayName } from "../generation/models/model-display-name";
import { useModelPresentation } from "../generation/models/model-logos";
import { defaultDraft, isModelId, useStudioStore } from "../generation/studio-state";
import { freeCanvasMessages } from "./free-canvas-messages";
import type { FreeCanvasItem } from "./free-canvas-state";

const resolutions = ["1.5K", "2K", "4K"] as const;
const ratios = ["1:1", "2:3", "3:2", "9:16", "16:9", "3:4", "4:3", "21:9"] as const;
const pollIntervalMs = 4000;
const pollTimeoutMs = 4 * 60 * 1000;

function outputAssetId(item: unknown) {
  if (!item || typeof item !== "object") return null;
  if (!("status" in item) || item.status !== "succeeded") return null;
  if (!("output_asset_id" in item) || typeof item.output_asset_id !== "string") return null;
  return item.output_asset_id;
}

function failedStatus(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  if (!("status" in payload) || typeof payload.status !== "string") return false;
  return payload.status === "failed" || payload.status === "partially_failed";
}

function taskOutput(payload: unknown) {
  if (!payload || typeof payload !== "object") return { failed: false, assetId: null };
  const items = "items" in payload && Array.isArray(payload.items) ? payload.items : [];
  const assetId = items.map(outputAssetId).find((id) => id !== null) ?? null;
  return { failed: failedStatus(payload), assetId };
}

/** 轮询刚提交的任务，返回第一张成功生成的素材；失败或超时返回 null。 */
async function waitForOutput(jobId: string, signal: AbortSignal) {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline && !signal.aborted) {
    const payload: unknown = await (await imageRequest(`image-tasks/${jobId}`, { signal })).json();
    rememberImageDeliveries(payload);
    const output = taskOutput(payload);
    if (output.assetId) return output.assetId;
    if (output.failed) return null;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollIntervalMs);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  return null;
}

function submissionError(error: unknown) {
  if (error instanceof ImageApiError) return error.message;
  return currentMessages(generationMessages).serviceUnavailable;
}

/** 生成失败优先于模型读取失败，取第一条需要提示的错误。 */
function requestError(
  submission: { error: unknown },
  models: { isError: boolean; error: unknown },
) {
  if (submission.error) return submissionError(submission.error);
  if (models.isError) return submissionError(models.error);
  return null;
}

/** 提交画布内生成并轮询结果；成功后把图片插入画布。 */
function useCanvasGeneration({
  prompt,
  ratio,
  resolution,
  model,
  onInsertImage,
}: {
  prompt: string;
  ratio: string;
  resolution: string;
  model: string;
  onInsertImage: (item: FreeCanvasItem) => void;
}) {
  const t = useMessages(freeCanvasMessages);
  const generate = useGenerateImage();
  const [waiting, setWaiting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const insert = (assetId: string) => {
    onInsertImage({
      id: crypto.randomUUID(),
      kind: "image",
      src: assetContentUrl(assetId),
      x: 80 + Math.random() * 120,
      y: 80 + Math.random() * 120,
      width: 420,
      height: 420,
      rotation: 0,
    });
  };

  const submit = (allowed: boolean) => {
    if (!allowed) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setWaiting(true);
    setStatus(t.queued);
    generate.mutate(
      {
        model,
        source: "free-canvas",
        draft: { ...defaultDraft, prompt: prompt.trim(), ratio, resolution, count: "1" },
      },
      {
        onError: () => {
          setWaiting(false);
          setStatus(t.failed);
        },
        onSuccess: async (result) => {
          const assetId = await waitForOutput(result.id, controller.signal);
          if (controller.signal.aborted) return;
          setWaiting(false);
          if (!assetId) {
            setStatus(t.failed);
            return;
          }
          insert(assetId);
          setStatus(t.submitted);
        },
      },
    );
  };

  return { waiting, status, submit, error: generate.feedbackError };
}

/** 左侧浮动创作卡：提示词、模型、比例、分辨率与发送按钮。 */
export function FreeCanvasComposer({
  onInsertImage,
}: {
  onInsertImage: (item: FreeCanvasItem) => void;
}) {
  const t = useMessages(freeCanvasMessages);
  const locale = useLocale();
  const catalog = useModelPresentation();
  const model = useStudioStore((state) => state.activeModel);
  const setActiveModel = useStudioStore((state) => state.setActiveModel);
  const models = (catalog.data?.models ?? []).filter((entry) => entry.id !== "nano-banana-2.1");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [resolution, setResolution] = useState<string>("1.5K");
  const session = useImageSession();
  const capabilities = useImageModels();
  const submission = useCanvasGeneration({ prompt, ratio, resolution, model, onInsertImage });
  useErrorToast(requestError(submission, capabilities));
  const enabled = modelCapabilities(capabilities.data, model, "create")?.enabledResolutions ?? [];
  const canGenerate =
    session.isSuccess &&
    !!capabilities.data?.enabled &&
    prompt.trim().length > 0 &&
    !submission.waiting &&
    enabled.some((value) => value === resolution);

  return (
    <aside aria-label={t.generator} className="fc-dock">
      <div className="fc-dock-body">
        <TextArea
          aria-label={t.prompt}
          className="fc-prompt"
          placeholder={t.promptPlaceholder}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="fc-dock-group">
          <span className="fc-label">{t.model}</span>
          <ToggleButtonGroup
            aria-label={t.model}
            className="fc-models"
            disallowEmptySelection
            isDetached
            selectedKeys={[model]}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const [next] = keys;
              if (isModelId(next)) setActiveModel(next);
            }}
          >
            {models.map((entry) => (
              <ToggleButton id={entry.id} key={entry.id}>
                {modelDisplayName(entry.id, models, locale) || entry.id}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <div className="fc-dock-group">
          <span className="fc-label">{t.ratio}</span>
          <ToggleButtonGroup
            aria-label={t.ratio}
            className="fc-ratios"
            disallowEmptySelection
            isDetached
            selectedKeys={[ratio]}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const [next] = keys;
              const value = ratios.find((item) => item === next);
              if (value) setRatio(value);
            }}
          >
            {ratios.map((value) => (
              <ToggleButton id={value} key={value}>
                {value}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <div className="fc-dock-group">
          <span className="fc-label">{t.resolution}</span>
          {session.isPending || capabilities.isLoading ? (
            <DataSkeleton layout="options" />
          ) : (
            <ToggleButtonGroup
              aria-label={t.resolution}
              className="fc-resolutions"
              disallowEmptySelection
              isDetached
              selectedKeys={[resolution]}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const [next] = keys;
                const value = resolutions.find((item) => item === next);
                if (value) setResolution(value);
              }}
            >
              {resolutions.map((value) => (
                <ToggleButton
                  id={value}
                  key={value}
                  isDisabled={!enabled.some((item) => item === value)}
                >
                  {value}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </div>
        {submission.status && (
          <p aria-live="polite" className="fc-status">
            {submission.status}
          </p>
        )}
      </div>
      <div className="fc-dock-footer">
        <span aria-hidden="true" className="fc-cost">
          <CreditCoin />
          <span>{imageUnitCredits}</span>
        </span>
        <Button
          aria-label={submission.waiting ? t.generating : t.generate}
          className="fc-send"
          isIconOnly
          isDisabled={!canGenerate}
          isPending={submission.waiting}
          onPress={() => submission.submit(canGenerate)}
        >
          <UiIcon icon={IconArrowUp} size="action" />
        </Button>
      </div>
    </aside>
  );
}

/** 选中项检查器：文字内容与层级、复制、删除。 */
export function FreeCanvasInspector({
  selected,
  onUpdate,
  onRemove,
  onForward,
  onBackward,
  onDuplicate,
}: {
  selected: FreeCanvasItem;
  onUpdate: (patch: Partial<Omit<FreeCanvasItem, "id">>) => void;
  onRemove: () => void;
  onForward: () => void;
  onBackward: () => void;
  onDuplicate: () => void;
}) {
  const t = useMessages(freeCanvasMessages);
  const label = selected.kind === "note" ? t.noteContent : t.textContent;
  return (
    <aside aria-label={t.selection} className="fc-inspector">
      <h2 className="fc-inspector-title">{t.selection}</h2>
      {selected.kind !== "image" && (
        <TextArea
          aria-label={label}
          className="fc-inspector-text"
          placeholder={selected.kind === "note" ? t.notePlaceholder : t.textPlaceholder}
          value={selected.text ?? ""}
          onChange={(event) => onUpdate({ text: event.target.value })}
        />
      )}
      <fieldset aria-label={t.actions} className="fc-inspector-actions">
        <Button
          isIconOnly
          aria-label={t.backward}
          onPress={onBackward}
          size="sm"
          variant="tertiary"
        >
          <UiIcon icon={IconArrowDown} size="small" />
        </Button>
        <Button isIconOnly aria-label={t.forward} onPress={onForward} size="sm" variant="tertiary">
          <UiIcon icon={IconArrowForwardUp} size="small" />
        </Button>
        <Button
          isIconOnly
          aria-label={t.duplicate}
          onPress={onDuplicate}
          size="sm"
          variant="tertiary"
        >
          <UiIcon icon={IconCopy} size="small" />
        </Button>
        <Button isIconOnly aria-label={t.remove} onPress={onRemove} size="sm" variant="danger">
          <UiIcon icon={IconTrash} size="small" />
        </Button>
      </fieldset>
    </aside>
  );
}
