import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import "../../../components/overlays/dialog-close.css";
import "../../../components/overlays/confirm-dialog.css";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { textileMessages } from "./textile-messages";
import { textileViewMessages } from "./textile-view-messages";
import { type TextileViewId, textileViewImages, textileViews } from "./textile-views";

/** 选择裂变视角的弹层：多选后确认，可重置为当前已选。 */
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
  const t = useMessages(textileMessages);
  const viewNames = useMessages(textileViewMessages);
  const popoverRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // 非模态弹层在失焦时关闭，但点空白处不会移动焦点；保留键盘与焦点行为，另外让外部按下也关闭它。
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
          <Popover.Heading className="textile-views-title">{t.viewTypes}</Popover.Heading>
          <Button
            isIconOnly
            variant="tertiary"
            className="dialog-close"
            aria-label={t.closeViews}
            onPress={onClose}
          >
            <UiIcon icon={IconX} size="action" />
          </Button>
        </div>
        <div className="textile-views-body">
          <p className="textile-view-count">{t.viewsSelected(pending.length)}</p>
          <ToggleButtonGroup
            aria-label={t.views}
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
                aria-label={viewNames[view.id]}
              >
                <span className="textile-view-example" aria-hidden="true">
                  {textileViewImages[view.id] && (
                    <img
                      src={textileViewImages[view.id]}
                      alt=""
                      width={480}
                      height={480}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  )}
                </span>
                <span className="textile-view-copy">
                  <strong>{viewNames[view.id]}</strong>
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
            {t.reset}
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
            {t.confirm}
          </Button>
        </div>
      </Popover.Dialog>
    </Popover.Content>
  );
}
