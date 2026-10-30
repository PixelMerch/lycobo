import { Button, Checkbox, Input, Label, TextArea, TextField } from "@heroui/react";
import { IconCheck, IconTrash, IconX } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useSmartVariationDraft } from "./smart-variation-state";
import { useVariationGeneration } from "./use-variation-generation";

export function VariationPlanPanel({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, ratio, resolution, update } = useSmartVariationDraft();
  const generation = useVariationGeneration();
  const selectedCount = items.filter((item) => item.selected).length;
  const patchItem = (id: string, patch: Partial<(typeof items)[number]>) =>
    update({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  if (!isOpen) return null;
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
          <h2 id="variation-plan-heading">确认每张图的中文提示词</h2>
        </div>
        <Button
          isIconOnly
          variant="tertiary"
          aria-label="关闭生成计划"
          onPress={() => onOpenChange(false)}
        >
          <UiIcon icon={IconX} size="action" />
        </Button>
      </header>
      <div className="variation-plan-body">
        <div className="variation-plan-list">
          {items.map((item, index) => (
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
              <TextField value={item.prompt} onChange={(prompt) => patchItem(item.id, { prompt })}>
                <Label className="sr-only">方案 {index + 1} 提示词</Label>
                <TextArea rows={3} maxLength={4000} />
              </TextField>
            </section>
          ))}
          {!items.length && <p className="variation-plan-empty">暂无方案，请重新生成计划。</p>}
        </div>
      </div>
      <footer className="variation-plan-footer">
        <div className="variation-plan-output">
          <span>
            {ratio} · {resolution} · 已选 {selectedCount} 张
          </span>
        </div>
        <Button
          isDisabled={!generation.canGenerate}
          isPending={generation.submitting}
          className="primary-action variation-generate"
          onPress={() => {
            void generation
              .submit()
              .then(() => onOpenChange(false))
              .catch(() => {});
          }}
        >
          {generation.pending ? "确认上次提交" : `开始生成 · ${generation.cost} 积分`}
        </Button>
      </footer>
    </section>
  );
}
