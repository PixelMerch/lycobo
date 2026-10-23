import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { type RefObject, useState } from "react";
import "../../../components/dialog-close.css";
import { UiIcon } from "../../../components/ui-icon";
import { type TextileViewId, textileViewImages, textileViews } from "./textile-views";

export function TextileViewsDialog({
  anchorRef,
  selected,
  onConfirm,
  onClose,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  selected: TextileViewId[];
  onConfirm: (values: TextileViewId[]) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(selected);
  return (
    <Popover.Content
      triggerRef={anchorRef}
      placement="bottom start"
      offset={0}
      containerPadding={0}
      shouldFlip={false}
      isNonModal
      className="textile-views-popover"
    >
      <Popover.Dialog className="textile-views-dialog">
        <div className="textile-views-header">
          <Popover.Heading>裂变类型</Popover.Heading>
          <Button
            isIconOnly
            variant="tertiary"
            className="dialog-close"
            aria-label="关闭裂变类型"
            onPress={onClose}
          >
            <UiIcon icon={IconX} size="action" />
          </Button>
        </div>
        <div className="textile-views-body">
          <p className="textile-view-count">已选 {pending.length} 个视角</p>
          <ToggleButtonGroup
            aria-label="裂变视角"
            className="textile-view-grid"
            selectionMode="multiple"
            selectedKeys={pending}
            onSelectionChange={(keys) => {
              setPending(textileViews.filter((view) => keys.has(view.id)).map((view) => view.id));
            }}
          >
            {textileViews.map((view) => (
              <ToggleButton
                key={view.id}
                id={view.id}
                className="textile-view-card"
                aria-label={view.name}
              >
                <span className="textile-view-example" aria-hidden="true">
                  {textileViewImages[view.id] && (
                    <img
                      src={textileViewImages[view.id]}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  )}
                </span>
                <span className="textile-view-copy">
                  <strong>{view.name}</strong>
                </span>
                {pending.includes(view.id) && (
                  <span className="textile-view-check">
                    <UiIcon icon={IconCheck} size="small" />
                  </span>
                )}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
        <div className="textile-views-footer">
          <Button variant="tertiary" onPress={() => setPending([])}>
            重置
          </Button>
          <Button
            variant="primary"
            className="primary-action"
            onPress={() => {
              onConfirm(pending);
              onClose();
            }}
          >
            确定
          </Button>
        </div>
      </Popover.Dialog>
    </Popover.Content>
  );
}
