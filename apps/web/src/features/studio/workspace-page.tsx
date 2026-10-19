import { Button, Checkbox, Label, Popover, Tabs, TextArea, TextField } from "@heroui/react";
import {
  IconChevronRight,
  IconDownload,
  IconHeart,
  IconLayersIntersect,
  IconPhoto,
  IconPlus,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate, useParams } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { ModelSelect } from "./model-select";
import {
  cases,
  type Draft,
  isModelId,
  type ModelId,
  photo,
  type ReferenceImage,
  type StudioCase,
  useStudioStore,
} from "./studio-state";

const fields = [
  { key: "resolution", label: "分辨率", values: ["1K", "2K", "4K"] },
  { key: "count", label: "生成张数", values: ["1", "2", "3", "4"] },
] as const;

export function WorkspacePage() {
  const { model } = useParams();
  if (!isModelId(model)) return null;
  return <Workspace model={model} />;
}
function Workspace({ model }: { model: ModelId }) {
  const draft = useStudioStore((s) => s.drafts[model]);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const visitModel = useStudioStore((s) => s.visitModel);
  const favorites = useStudioStore((s) => s.favorites);
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  const [tab, setTab] = useState("cases");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [currentOnly, setCurrentOnly] = useState(true);
  const [selectedCase, setSelectedCase] = useState<string>(cases[0].id);
  const navigate = useNavigate();
  const inputId = useRef<HTMLTextAreaElement>(null);
  const visibleCases = cases.filter((item) => !onlyFavorites || favorites.includes(item.id));
  const current = visibleCases.find((item) => item.id === selectedCase) ?? visibleCases[0];
  useEffect(() => {
    visitModel(model);
  }, [model, visitModel]);
  function appendCase(item: StudioCase) {
    // Additive reuse retains existing input instead of silently replacing a pending draft.
    updateDraft(model, { prompt: draft.prompt ? `${draft.prompt}\n${item.prompt}` : item.prompt });
    inputId.current?.focus();
  }
  return (
    <div className="workspace">
      <section className="composer-panel" aria-label="创作设置">
        <section className="composer-scroll" aria-label="创作参数">
          <ModelSelect value={model} onChange={(id) => navigate(`/create/${id}`)} />
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
              onChange={(value) => updateDraft(model, { [field.key]: value })}
            />
          ))}
        </section>
        <div className="generate-area">
          <Button className="primary-action" isDisabled>
            <UiIcon icon={IconSparkles} />
            生成图片
          </Button>
        </div>
      </section>
      <section className="results-panel" aria-label="创作内容">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => setTab(String(key))}
          className="workspace-tabs"
        >
          <div className="results-toolbar">
            <Tabs.List aria-label="工作区内容">
              <Tabs.Tab id="history">
                历史记录
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="cases">
                案例库
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
            <div className="history-filters">
              <StudioCheckbox selected={currentOnly} onChange={setCurrentOnly}>
                仅看当前模型
              </StudioCheckbox>
              <StudioCheckbox selected={onlyFavorites} onChange={setOnlyFavorites}>
                仅看收藏
              </StudioCheckbox>
            </div>
          </div>
          <Tabs.Panel id="history">
            <div className="empty-state">
              <UiIcon icon={IconPhoto} size="illustration" />
              <h2>还没有生成记录</h2>
              <p>你的生成结果会保留在这里。</p>
              <Button variant="secondary" onPress={() => setTab("cases")}>
                浏览创作案例
              </Button>
            </div>
          </Tabs.Panel>
          <Tabs.Panel id="cases">
            {current ? (
              <article className="result-record">
                <div className="record-header">
                  <div>
                    <h1>{current.title}</h1>
                    <div className="metadata">
                      <span>创作案例</span>
                      <span>1:1</span>
                      <span>家纺三件套</span>
                    </div>
                  </div>
                  <Button
                    variant="tertiary"
                    className="small-button"
                    onPress={() => appendCase(current)}
                  >
                    引用提示词
                  </Button>
                </div>
                <p className="record-prompt">{current.prompt}</p>
                <div className="reference-context">
                  <img src={photo("set", true)} alt="三件套参考案例" width="56" height="56" />
                  <img src={photo(current.image, true)} alt="场景参考案例" width="56" height="56" />
                </div>
                <img
                  className="result-image"
                  src={photo(current.image)}
                  alt={current.title}
                  width="960"
                  height="960"
                />
                <div className="result-actions">
                  <a
                    className="neutral-button"
                    href={photo(current.image)}
                    download={`lycoboai-${current.title}.webp`}
                  >
                    <UiIcon icon={IconDownload} />
                    下载
                  </a>
                  <Button
                    variant="tertiary"
                    aria-pressed={favorites.includes(current.id)}
                    onPress={() => toggleFavorite(current.id)}
                  >
                    <UiIcon icon={IconHeart} />
                    {favorites.includes(current.id) ? "已收藏" : "收藏"}
                  </Button>
                  <Button variant="tertiary" onPress={() => appendCase(current)}>
                    引用提示词
                  </Button>
                </div>
              </article>
            ) : (
              <div className="empty-state">
                <h2>还没有收藏案例</h2>
                <Button variant="secondary" onPress={() => setOnlyFavorites(false)}>
                  查看全部案例
                </Button>
              </div>
            )}
          </Tabs.Panel>
        </Tabs>
      </section>
      <aside className="history-rail" aria-label="案例索引">
        <h2>{tab === "history" ? "历史" : "案例"}</h2>
        {tab === "cases" ? (
          visibleCases.map((item) => (
            <Button
              key={item.id}
              variant="tertiary"
              className="history-thumb"
              aria-label={`定位案例：${item.title}`}
              aria-pressed={current?.id === item.id}
              onPress={() => setSelectedCase(item.id)}
            >
              <img src={photo(item.image, true)} alt={item.title} width="96" height="96" />
            </Button>
          ))
        ) : (
          <p>暂无记录</p>
        )}
      </aside>
    </div>
  );
}
function StudioCheckbox({
  children,
  selected,
  onChange,
}: {
  children: string;
  selected: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Checkbox isSelected={selected} onChange={onChange}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Label>{children}</Label>
      </Checkbox.Content>
    </Checkbox>
  );
}
function ParameterGroup({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="parameter-group">
      <legend>{label}</legend>
      <div className="parameter-options">
        {values.map((option) => (
          <Button
            key={option}
            variant="tertiary"
            aria-label={`${label} ${option}`}
            aria-pressed={value === option}
            onPress={() => onChange(option)}
          >
            <span>{option}</span>
          </Button>
        ))}
      </div>
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
  return (
    <section ref={groupRef} className="parameter-group ratio-group" aria-label="图片比例">
      <Popover isOpen={open} onOpenChange={setOpen}>
        <div className="ratio-heading">
          <h2>图片比例</h2>
          <Button
            className="ratio-expand"
            variant="tertiary"
            aria-label="展开全部图片比例"
            aria-expanded={open}
          >
            <span>{value}</span>
            <span className="ratio-chevron">
              <UiIcon icon={IconChevronRight} size="small" />
            </span>
          </Button>
        </div>
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
            <div className="parameter-options ratio-options ratio-extra-options">
              {additionalRatios.map((ratio) => (
                <Button
                  key={ratio}
                  variant="tertiary"
                  aria-label={`图片比例 ${ratio}`}
                  aria-pressed={value === ratio}
                  onPress={() => {
                    onChange(ratio);
                    setOpen(false);
                  }}
                >
                  <RatioPreview ratio={ratio} />
                  <span>{ratio}</span>
                </Button>
              ))}
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <div className="parameter-options ratio-options">
        {commonRatios.map((ratio) => (
          <Button
            key={ratio}
            variant="tertiary"
            aria-label={`图片比例 ${ratio}`}
            aria-pressed={value === ratio}
            onPress={() => onChange(ratio)}
          >
            <RatioPreview ratio={ratio} />
            <span>{ratio}</span>
          </Button>
        ))}
        <Button
          variant="tertiary"
          aria-label="更多图片比例"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-pressed={extendedSelected}
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
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
