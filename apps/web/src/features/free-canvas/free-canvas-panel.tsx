import { Button, TextArea, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconArrowBackUp, IconArrowsMaximize } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useLocale } from "../../i18n/locale-store";
import { currentMessages, useMessages } from "../../i18n/messages";
import { useErrorToast } from "../../lib/error-toast";
import { assetContentUrl, rememberImageDeliveries } from "../generation/asset-delivery-client";
import { GenerateButton } from "../generation/composer/generate-button";
import { ParameterGroup } from "../generation/composer/parameter-group";
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

/** 选中项：文字内容与层级、复制、删除操作。 */
function SelectionSection({
  selected,
  onUpdate,
  onRemove,
  onForward,
  onBackward,
  onDuplicate,
  onAddLocalImage,
}: {
  selected: FreeCanvasItem | null;
  onUpdate: (patch: Partial<Omit<FreeCanvasItem, "id">>) => void;
  onRemove: () => void;
  onForward: () => void;
  onBackward: () => void;
  onDuplicate: () => void;
  onAddLocalImage: () => void;
}) {
  const t = useMessages(freeCanvasMessages);
  const label = selected?.kind === "note" ? t.noteContent : t.textContent;
  return (
    <section className="free-canvas-section">
      <h2>{t.selection}</h2>
      {selected ? (
        <>
          {selected.kind !== "image" && (
            <div className="free-canvas-field">
              <span>{label}</span>
              <TextArea
                aria-label={label}
                className="free-canvas-text"
                placeholder={selected.kind === "note" ? t.notePlaceholder : t.textPlaceholder}
                value={selected.text ?? ""}
                onChange={(event) => onUpdate({ text: event.target.value })}
              />
            </div>
          )}
          <fieldset className="free-canvas-actions">
            <legend className="sr-only">{t.actions}</legend>
            <Button size="sm" variant="tertiary" onPress={onBackward}>
              <UiIcon icon={IconArrowBackUp} size="small" />
              {t.backward}
            </Button>
            <Button size="sm" variant="tertiary" onPress={onDuplicate}>
              {t.duplicate}
            </Button>
            <Button size="sm" variant="tertiary" onPress={onForward}>
              <UiIcon icon={IconArrowsMaximize} size="small" />
              {t.forward}
            </Button>
            <Button size="sm" variant="danger" onPress={onRemove}>
              {t.remove}
            </Button>
          </fieldset>
        </>
      ) : (
        <p className="free-canvas-note">{t.empty}</p>
      )}
      <Button className="free-canvas-add" size="sm" variant="tertiary" onPress={onAddLocalImage}>
        {t.addImage}
      </Button>
      <p className="free-canvas-note">{t.uploadHint}</p>
    </section>
  );
}

/** 生成区：模型、提示词、比例、分辨率与提交。 */
function GeneratorSection({ onInsertImage }: { onInsertImage: (item: FreeCanvasItem) => void }) {
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
    <section className="free-canvas-section">
      <h2>{t.generator}</h2>
      <section aria-label={t.model} className="free-canvas-field">
        <span>{t.model}</span>
        <ToggleButtonGroup
          aria-label={t.model}
          className="free-canvas-models"
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
      </section>
      <div className="free-canvas-field">
        <span>{t.prompt}</span>
        <TextArea
          aria-label={t.prompt}
          className="free-canvas-text"
          placeholder={t.promptPlaceholder}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>
      <section aria-label={t.ratio} className="free-canvas-field">
        <span>{t.ratio}</span>
        <ToggleButtonGroup
          aria-label={t.ratio}
          className="free-canvas-ratios"
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
      </section>
      <ParameterGroup
        disabledValues={resolutions.filter((value) => !enabled.some((item) => item === value))}
        label={t.resolution}
        onChange={setResolution}
        selectionId="free-canvas-resolution"
        value={resolution}
        values={resolutions}
      />
      <p className="free-canvas-note">{t.countNote}</p>
      <div className="free-canvas-generate">
        <GenerateButton
          cost={imageUnitCredits}
          isDisabled={!canGenerate}
          label={submission.waiting ? t.generating : t.generate}
          onPress={() => submission.submit(canGenerate)}
          submitting={submission.waiting}
          submittingLabel={t.generating}
        />
      </div>
      {submission.status && (
        <p aria-live="polite" className="free-canvas-note">
          {submission.status}
        </p>
      )}
      <p className="free-canvas-note">{t.persistence}</p>
    </section>
  );
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

  return { waiting, status, submit, error: generate.error };
}

/** 画布右侧面板：选中项操作与模型生成。 */
export function FreeCanvasPanel(props: {
  selected: FreeCanvasItem | null;
  onUpdate: (patch: Partial<Omit<FreeCanvasItem, "id">>) => void;
  onRemove: () => void;
  onForward: () => void;
  onBackward: () => void;
  onDuplicate: () => void;
  onInsertImage: (item: FreeCanvasItem) => void;
  onAddLocalImage: () => void;
}) {
  const t = useMessages(freeCanvasMessages);
  return (
    <aside aria-label={t.panelAria} className="free-canvas-panel">
      <SelectionSection
        onAddLocalImage={props.onAddLocalImage}
        onBackward={props.onBackward}
        onDuplicate={props.onDuplicate}
        onForward={props.onForward}
        onRemove={props.onRemove}
        onUpdate={props.onUpdate}
        selected={props.selected}
      />
      <GeneratorSection onInsertImage={props.onInsertImage} />
    </aside>
  );
}
