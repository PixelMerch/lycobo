import { Button, Checkbox, Input, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { IconCheck, IconTrash, IconX } from "@tabler/icons-react";
import { useLayoutEffect, useRef } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { previewPlanItems } from "./plan-stream";
import { useSmartVariationDraft } from "./smart-variation-state";
import { useVariationGeneration } from "./use-variation-generation";

function PlanPrompt({
  value,
  index,
  onChange,
}: {
  value: string;
  index: number;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = -1;
    const fit = () => {
      element.style.height = value.length === 0 ? "" : "auto";
      const border = element.offsetHeight - element.clientHeight;
      element.style.height = `${element.scrollHeight + border}px`;
    };
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(next - width) < 1) return;
      width = next;
      fit();
    });
    fit();
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return (
    <TextField value={value} onChange={onChange}>
      <Label className="sr-only">方案 {index + 1} 提示词</Label>
      <TextArea ref={ref} rows={3} maxLength={4000} />
    </TextField>
  );
}

export function VariationPlanPanel({
  isOpen,
  onOpenChange,
  analyzing = false,
  streamText = "",
  readingWeb = false,
  analysisError,
}: {
  isOpen: boolean;
  analyzing?: boolean;
  streamText?: string;
  readingWeb?: boolean;
  analysisError?: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, ratio, resolution, update } = useSmartVariationDraft();
  const generation = useVariationGeneration();
  const previews = previewPlanItems(streamText);
  const showPreview = analyzing || !!analysisError;
  const selectedCount = items.filter((item) => item.selected).length;
  const patchItem = (id: string, patch: Partial<(typeof items)[number]>) =>
    update({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  if (!isOpen) return null;
  const planningStatus = previews.length
    ? "正在完善方案，完成后即可编辑确认…"
    : "正在规划，请稍候…";
  const analysisStatus = readingWeb ? "DeepSeek 正在读取网页内容…" : planningStatus;
  return (
    <section
      className="variation-plan-panel"
      aria-labelledby="variation-plan-heading"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <header className="variation-plan-header">
        <div>
          <h2 id="variation-plan-heading">
            {analyzing ? "正在生成套图计划" : "确认每张图的中文提示词"}
          </h2>
        </div>
        <Button
          isIconOnly
          variant="tertiary"
          className="dialog-close"
          aria-label="关闭生成计划"
          onPress={() => onOpenChange(false)}
        >
          <UiIcon icon={IconX} size="action" />
        </Button>
      </header>
      <div className="variation-plan-body">
        <div className="variation-plan-list">
          {showPreview && (
            <>
              <p className="variation-plan-stream-status" role="status">
                {analysisError || analysisStatus}
              </p>
              {previews.map((item, index) => (
                <section
                  className="variation-plan-card"
                  key={item.id}
                  aria-label={`生成中的方案 ${index + 1}`}
                >
                  <div className="variation-plan-card-heading">
                    <span className="variation-plan-number">{index + 1}</span>
                    <h3>{item.title || "正在生成标题…"}</h3>
                  </div>
                  <p className="variation-plan-stream-prompt">{item.prompt || "正在编写提示词…"}</p>
                </section>
              ))}
            </>
          )}
          {!showPreview &&
            items.map((item, index) => (
              <section
                className="variation-plan-card"
                data-selected={item.selected}
                key={item.id}
                aria-label={`方案 ${index + 1}`}
              >
                <div className="variation-plan-card-heading">
                  <span className="variation-plan-number">{index + 1}</span>
                  <TextField
                    value={item.title}
                    onChange={(title) => patchItem(item.id, { title })}
                    className="variation-plan-title"
                  >
                    <Label className="sr-only">方案 {index + 1} 名称</Label>
                    <Input maxLength={40} />
                  </TextField>
                  <Checkbox
                    isSelected={item.selected}
                    onChange={(selected) => patchItem(item.id, { selected })}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator>
                          <UiIcon icon={IconCheck} size="small" />
                        </Checkbox.Indicator>
                      </Checkbox.Control>
                      <span className="sr-only">选择方案 {index + 1}</span>
                    </Checkbox.Content>
                  </Checkbox>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    aria-label={`删除方案 ${index + 1}`}
                    onPress={() => update({ items: items.filter((entry) => entry.id !== item.id) })}
                  >
                    <UiIcon icon={IconTrash} />
                  </Button>
                </div>
                <PlanPrompt
                  value={item.prompt}
                  index={index}
                  onChange={(prompt) => patchItem(item.id, { prompt })}
                />
              </section>
            ))}
          {!showPreview && !items.length && (
            <p className="variation-plan-empty">暂无方案，请重新生成计划。</p>
          )}
        </div>
      </div>
      <footer className="variation-plan-footer">
        <div className="variation-plan-output">
          <span>
            {ratio} · {resolution} ·{" "}
            {showPreview ? "计划完成后可确认生成" : `已选 ${selectedCount} 张`}
          </span>
        </div>
        <Button
          isDisabled={showPreview || !generation.canGenerate}
          isPending={generation.submitting}
          className="primary-action variation-generate"
          onPress={() => {
            void generation
              .submit()
              .then(() => onOpenChange(false))
              .catch(() => undefined);
          }}
        >
          {generation.submitting && (
            <Spinner size="md" color="current" role="status" aria-label="正在提交裂变任务" />
          )}
          {generation.pending ? "确认上次提交" : `开始生成 · ${generation.cost} 积分`}
        </Button>
      </footer>
    </section>
  );
}
