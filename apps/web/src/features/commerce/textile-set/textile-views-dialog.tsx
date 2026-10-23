import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import "../../../components/dialog-close.css";
import "../../../components/confirm-dialog.css";
import { UiIcon } from "../../../components/ui-icon";
import { type TextileViewId, textileViewImages, textileViews } from "./textile-views";

export function TextileViewsDialog({
  anchorRef,
  triggerRef,
  selected,
  onConfirm,
  onClose,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  selected: TextileViewId[];
  onConfirm: (values: TextileViewId[]) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(selected);
  const popoverRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Non-modal React Aria popovers dismiss on blur, but blank areas do not move focus.
    // Keep its keyboard/focus behavior and also dismiss pointer presses outside.
    function dismissOutside(event: PointerEvent) {
      const path = event.composedPath();
      if (
        popoverRef.current &&
        !path.includes(popoverRef.current) &&
        (!triggerRef.current || !path.includes(triggerRef.current))
      )
        onClose();
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [onClose, triggerRef]);
  return (
    <Popover.Content
      ref={popoverRef}
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
          <Button
            variant="secondary"
            size="sm"
            className="confirm-dialog__cancel"
            onPress={() => setPending([])}
          >
            重置
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="confirm-dialog__confirm"
            onPress={() => {
              onConfirm(pending);
              onClose();
            }}
          >
            确认
          </Button>
        </div>
      </Popover.Dialog>
    </Popover.Content>
  );
}
