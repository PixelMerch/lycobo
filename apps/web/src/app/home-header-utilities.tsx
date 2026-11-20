import { Button, Popover } from "@heroui/react";
import { IconBook } from "@tabler/icons-react";
import { UiIcon } from "../components/ui-icon";
import { useMessages } from "../i18n/messages";
import { useHoverMenu } from "../lib/use-hover-menu";
import { shellMessages } from "./shell-messages";

/** 以鼠标悬停或点按打开共用的创作指南。 */
export function HeaderCreationGuide({
  dismissVersion,
  popoverClassName,
  popoverOffset = 4,
}: {
  dismissVersion?: number;
  popoverClassName?: string;
  popoverOffset?: number;
} = {}) {
  const t = useMessages(shellMessages);
  const menu = useHoverMenu(160, dismissVersion);
  return (
    <Popover isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
      <Button
        ref={menu.triggerRef}
        isIconOnly
        size="sm"
        variant="tertiary"
        aria-label={t.creationHelp}
        className="home-header-tool header-creation-guide"
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") menu.openOnHover();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") menu.closeSoon();
        }}
      >
        <UiIcon icon={IconBook} size="navigation" />
      </Button>
      <Popover.Content
        ref={menu.popoverRef}
        className={`home-header-help${popoverClassName ? ` ${popoverClassName}` : ""}`}
        placement="bottom end"
        offset={popoverOffset}
        aria-label={t.creationHelp}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <b>{t.creationHelp}</b>
        <ul>
          {t.creationHelpItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Popover.Content>
    </Popover>
  );
}
