import { Button, Checkbox, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import { IconCheck, IconTrash } from "@tabler/icons-react";
import { DialogClose } from "../../../components/dialog-close";
import { UiIcon } from "../../../components/ui-icon";
import { examplePlan, useSmartVariationDraft } from "./smart-variation-state";

export function VariationPlanDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, ratio, resolution, update } = useSmartVariationDraft();
  const selectedCount = items.filter((item) => item.selected).length;
  const patchItem = (id: string, patch: Partial<(typeof items)[number]>) =>
    update({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop className="variation-backdrop">
        <Modal.Container scroll="inside">
          <Modal.Dialog className="variation-plan-dialog">
            <Modal.Header>
              <div>
                <span className="variation-example-tag">示例计划</span>
                <Modal.Heading>确认每张图的中文提示词</Modal.Heading>
                <p>以下是换色示例，可编辑查看效果；不会提交生成。</p>
              </div>
              <DialogClose label="关闭套图生成计划" />
            </Modal.Header>
            <Modal.Body>
              <div className="variation-plan-list">
                {items.map((item, index) => (
                  <section
                    className="variation-plan-card"
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
                        onPress={() =>
                          update({ items: items.filter((entry) => entry.id !== item.id) })
                        }
                      >
                        <UiIcon icon={IconTrash} />
                      </Button>
                    </div>
                    <TextField
                      value={item.prompt}
                      onChange={(prompt) => patchItem(item.id, { prompt })}
                    >
                      <Label className="sr-only">方案 {index + 1} 提示词</Label>
                      <TextArea rows={3} maxLength={5000} />
                    </TextField>
                  </section>
                ))}
                {!items.length && (
                  <p className="variation-plan-empty">暂无方案，可以恢复示例后继续查看。</p>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer className="variation-plan-footer">
              <div className="variation-plan-output">
                <span>
                  {ratio} · {resolution} · 已选 {selectedCount} 张
                </span>
              </div>
              <Button size="sm" variant="tertiary" onPress={() => update({ items: examplePlan() })}>
                恢复示例
              </Button>
              <Button isDisabled className="variation-generate">
                开始生成
              </Button>
              <p className="variation-plan-availability">生成功能暂未开放</p>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
