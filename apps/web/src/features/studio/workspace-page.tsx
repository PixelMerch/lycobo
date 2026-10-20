import {
  Alert,
  Button,
  Label,
  Popover,
  Tabs,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@heroui/react";
import {
  IconArrowBarToUp,
  IconChevronRight,
  IconLayersIntersect,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { type Key, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { UiIcon } from "../../components/ui-icon";
import {
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "./generation-client";
import { GenerationHistory, HistoryIndex } from "./generation-history";
import { ModelSelect } from "./model-select";
import { type Draft, type ModelId, type ReferenceImage, useStudioStore } from "./studio-state";

const fields = [
  { key: "resolution", label: "分辨率", values: ["1K", "2K", "4K"] },
  { key: "count", label: "生成张数", values: ["1", "2", "3", "4"] },
] as const;

export function WorkspacePage() {
  const model = useStudioStore((s) => s.activeModel);
  return <Workspace model={model} />;
}
function Workspace({ model }: { model: ModelId }) {
  const draft = useStudioStore((s) => s.drafts[model]);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const setActiveModel = useStudioStore((s) => s.setActiveModel);
  const visitModel = useStudioStore((s) => s.visitModel);
  const inputId = useRef<HTMLTextAreaElement>(null);
  const session = useImageSession();
  const modelQuery = useImageModels();
  const generate = useGenerateImage();
  const resolutions =
    modelQuery.data?.models.find((entry) => entry.id === model)?.enabledResolutions ?? [];
  const pending = usePendingSubmission(session.data);
  const canGenerate =
    session.isSuccess &&
    modelQuery.data?.enabled &&
    !generate.isPending &&
    (pending ||
      (draft.prompt.trim().length > 0 &&
        resolutions.some((value) => value === draft.resolution) &&
        (!draft.references.length || modelQuery.data.editsEnabled)));
  useEffect(() => {
    visitModel(model);
  }, [model, visitModel]);
  return (
    <div className="workspace">
      <section className="composer-panel" aria-label="创作设置">
        <section className="composer-scroll" aria-label="创作参数">
          <ModelSelect
            value={model}
            onChange={(nextModel) => {
              if (nextModel === model) return;
              const supported = modelQuery.data?.models.find(
                (entry) => entry.id === nextModel,
              )?.enabledResolutions;
              updateDraft(nextModel, {
                ...draft,
                resolution: supported?.some((value) => value === draft.resolution)
                  ? draft.resolution
                  : "1K",
              });
              setActiveModel(nextModel);
            }}
          />
          <ReferencePicker model={model} references={draft.references} />
          <TextField className="prompt-field">
            <Label>提示词</Label>
            <TextArea
              ref={inputId}
              value={draft.prompt}
              onChange={(event) => updateDraft(model, { prompt: event.target.value })}
              placeholder="描述你想要的画面，例如：保留商品，替换为原木卧室场景"
              maxLength={9000}
            />
          </TextField>
          <RatioPicker value={draft.ratio} onChange={(ratio) => updateDraft(model, { ratio })} />
          {fields.map((field) => (
            <ParameterGroup
              key={field.key}
              label={field.label}
              values={field.values}
              value={draft[field.key]}
              disabledValues={
                field.key === "resolution"
                  ? field.values.filter(
                      (value) => !resolutions.some((enabled) => enabled === value),
                    )
                  : []
              }
              onChange={(value) => updateDraft(model, { [field.key]: value })}
            />
          ))}
        </section>
        <div className="generate-area">
          {(session.isError || modelQuery.isError || generate.isError) && (
            <Alert className="generation-message" role="alert" status="danger">
              <Alert.Content>
                <Alert.Description>
                  {session.error?.message ??
                    modelQuery.error?.message ??
                    (pending
                      ? "提交结果待确认，请点击确认上次提交，避免重复生成。"
                      : generate.error?.message)}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {modelQuery.data && !modelQuery.data.enabled && (
            <Alert className="generation-message" role="status" status="warning">
              <Alert.Content>
                <Alert.Description>生图服务尚未启用</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {draft.references.length > 0 && modelQuery.data && !modelQuery.data.editsEnabled && (
            <Alert className="generation-message" role="status" status="warning">
              <Alert.Content>
                <Alert.Description>
                  当前服务尚未启用参考图编辑，可先不上传图片进行创作。
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <Button
            className="primary-action"
            isDisabled={!canGenerate}
            onPress={() =>
              generate.mutate(
                { model, draft },
                {
                  onSuccess: () => {
                    if (!pending && useStudioStore.getState().drafts[model] === draft) {
                      updateDraft(model, { prompt: "", references: [] });
                    }
                  },
                },
              )
            }
          >
            <UiIcon icon={IconSparkles} />
            {generate.isPending ? "正在提交…" : pending ? "确认上次提交" : "立即生成"}
          </Button>
        </div>
      </section>
      <section className="results-panel" aria-label="创作内容">
        <Tabs className="workspace-tabs">
          <Tabs.ListContainer>
            <Tabs.List aria-label="工作区内容">
              <Tabs.Tab id="history">历史记录</Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="history">
            <GenerationHistory />
          </Tabs.Panel>
        </Tabs>
      </section>
      <HistoryIndex />
      <BackToTopButton />
    </div>
  );
}
function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 240);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  if (!visible) return null;
  return (
    <Tooltip delay={0}>
      <Button
        isIconOnly
        variant="tertiary"
        className="back-to-top-button"
        aria-label="回到顶部"
        onPress={() =>
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          })
        }
      >
        <UiIcon icon={IconArrowBarToUp} size="illustration" />
      </Button>
      <Tooltip.Content placement="bottom">回到顶部</Tooltip.Content>
    </Tooltip>
  );
}
function ParameterGroup({
  label,
  values,
  value,
  onChange,
  disabledValues = [],
}: {
  label: string;
  values: readonly string[];
  disabledValues?: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="parameter-group">
      <legend>{label}</legend>
      <ToggleButtonGroup
        aria-label={label}
        className="parameter-options"
        disallowEmptySelection
        isDetached
        selectedKeys={[value]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (next !== undefined) onChange(String(next));
        }}
      >
        {values.map((option) => (
          <ToggleButton key={option} id={option} isDisabled={disabledValues.includes(option)}>
            <span>{option}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </fieldset>
  );
}
const commonRatios = ["1:1", "16:9", "2:1", "3:2", "4:3"];
const additionalRatios = ["21:9", "9:16", "1:2", "2:3", "3:4", "9:21"];

function subscribeRatioViewport(onChange: () => void) {
  const media = window.matchMedia("(min-width: 900px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getRatioViewport = () => window.matchMedia("(min-width: 900px)").matches;
const getServerRatioViewport = () => false;

function RatioPicker({ value, onChange }: { value: string; onChange: (ratio: string) => void }) {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLElement>(null);
  const wideViewport = useSyncExternalStore(
    subscribeRatioViewport,
    getRatioViewport,
    getServerRatioViewport,
  );
  const extendedSelected = additionalRatios.includes(value);
  const select = (keys: Set<Key>) => {
    const [next] = [...keys];
    if (next === undefined) return;
    onChange(String(next));
    if (additionalRatios.includes(String(next))) setOpen(false);
  };
  return (
    <section ref={groupRef} className="parameter-group ratio-group" aria-label="图片比例">
      <div className="ratio-heading">
        <h2>图片比例</h2>
        <Popover isOpen={open} onOpenChange={setOpen}>
          <Button className="ratio-expand" variant="tertiary" aria-label="展开全部图片比例">
            <span>{value}</span>
            <span className="ratio-chevron">
              <UiIcon icon={IconChevronRight} size="small" />
            </span>
          </Button>
          <Popover.Content
            triggerRef={groupRef}
            placement={wideViewport ? "right top" : "bottom start"}
            offset={wideViewport ? 32 : 8}
            shouldFlip={!wideViewport}
            className="ratio-popover"
          >
            <Popover.Dialog className="ratio-popover-dialog" aria-label="更多图片比例">
              <div className="ratio-popover-heading">
                <Popover.Heading>图片比例</Popover.Heading>
                <Button
                  isIconOnly
                  variant="tertiary"
                  className="icon-button ratio-close"
                  aria-label="关闭图片比例"
                  onPress={() => setOpen(false)}
                >
                  <span className="ratio-close-visual">
                    <UiIcon icon={IconX} />
                  </span>
                </Button>
              </div>
              <ToggleButtonGroup
                aria-label="更多图片比例"
                className="parameter-options ratio-options ratio-extra-options"
                disallowEmptySelection
                isDetached
                selectedKeys={extendedSelected ? [value] : []}
                selectionMode="single"
                onSelectionChange={select}
              >
                {additionalRatios.map((ratio) => (
                  <ToggleButton key={ratio} id={ratio}>
                    <RatioPreview ratio={ratio} />
                    <span>{ratio}</span>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
      <div className="parameter-options ratio-options">
        <ToggleButtonGroup
          aria-label="常用图片比例"
          className="ratio-common-options"
          disallowEmptySelection
          isDetached
          selectedKeys={commonRatios.includes(value) ? [value] : []}
          selectionMode="single"
          onSelectionChange={select}
        >
          {commonRatios.map((ratio) => (
            <ToggleButton key={ratio} id={ratio}>
              <RatioPreview ratio={ratio} />
              <span>{ratio}</span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button
          className="ratio-more"
          variant="tertiary"
          aria-label="更多图片比例"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-selected={extendedSelected || undefined}
          onPress={() => setOpen(true)}
        >
          {extendedSelected ? (
            <RatioPreview ratio={value} />
          ) : (
            <span className="ratio-preview ratio-more-icon">
              <UiIcon icon={IconLayersIntersect} />
            </span>
          )}
          <span>{extendedSelected ? value : "更多"}</span>
        </Button>
      </div>
    </section>
  );
}

function RatioPreview({ ratio }: { ratio: string }) {
  const [horizontal = 1, vertical = 1] = ratio.split(":").map(Number);
  const proportion = horizontal / vertical;
  const width = 24 * Math.min(1, proportion);
  const height = 24 * Math.min(1, 1 / proportion);
  return (
    <svg className="ratio-preview" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect
        x={(32 - width) / 2}
        y={(32 - height) / 2}
        width={width}
        height={height}
        rx="2"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ReferencePicker({
  model,
  references,
}: {
  model: ModelId;
  references: Draft["references"];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const addReferences = useStudioStore((s) => s.addReferences);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  async function readFiles(files: File[]) {
    if (reading) return;
    const remaining = 5 - useStudioStore.getState().drafts[model].references.length;
    if (files.length > remaining) {
      setError("最多添加 5 张参考图，请减少文件后重试。");
      return;
    }
    if (
      files.some(
        (file) =>
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setError("请选择 PNG、JPEG 或 WebP 图片，单张不超过 10MB。");
      return;
    }
    setReading(true);
    setError("");
    try {
      const images = await Promise.all(
        files.map(async (file): Promise<ReferenceImage> => {
          const src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === "string"
                ? resolve(reader.result)
                : reject(new Error("invalid image"));
            reader.onerror = () => reject(new Error("read failed"));
            reader.readAsDataURL(file);
          });
          await new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("decode failed"));
            image.src = src;
          });
          return { id: crypto.randomUUID(), name: file.name, src };
        }),
      );
      addReferences(model, images);
    } catch {
      setError("图片无法读取，请检查文件后重试。");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="reference-picker">
      <div className="field-title">
        <h2>
          上传图片<small>（最多上传5张参考图）</small>
        </h2>
        <Button
          variant="tertiary"
          className="clear-references"
          aria-label="清除全部参考图片"
          isDisabled={reading || references.length === 0}
          onPress={() => {
            updateDraft(model, { references: [] });
            setError("");
            if (input.current) input.current.value = "";
          }}
        >
          <UiIcon icon={IconTrash} size="small" />
          清除
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        aria-label="添加参考图片"
        className="visually-hidden"
        disabled={reading || references.length >= 5}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void readFiles(files);
        }}
      />
      <div className="reference-grid">
        {references.map((image, index) => (
          <div className="reference-tile" key={image.id}>
            <img src={image.src} alt={`图片${index + 1}`} />
            <Button
              isIconOnly
              variant="secondary"
              className="remove-reference"
              aria-label={`移除参考图：图片${index + 1}`}
              onPress={() =>
                updateDraft(model, {
                  references: references.filter((item) => item.id !== image.id),
                })
              }
            >
              <UiIcon icon={IconX} size="small" />
            </Button>
            <span className="reference-number">图片{index + 1}</span>
          </div>
        ))}
        {references.length < 5 ? (
          <Button
            variant="tertiary"
            className="add-reference"
            isDisabled={reading || references.length >= 5}
            aria-label="添加参考图"
            onPress={() => input.current?.click()}
          >
            <UiIcon icon={IconPlus} size="action" />
            <span>{reading ? "读取中…" : "添加图片"}</span>
          </Button>
        ) : null}
      </div>
      {error ? (
        <Alert className="field-error" role="alert" status="danger">
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </section>
  );
}
