import { Dropdown } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { UiIcon } from "../components/ui-icon";
import {
  commercePath,
  commerceToolFromSearch,
  commerceToolHref,
  commerceTools,
} from "../features/commerce/commerce-tools";
import { workspaceToolMessages } from "../features/workspace/workspace-tool-messages";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { useMessages } from "../i18n/messages";
import { useAppLocation, useAppNavigate } from "../i18n/use-localized-navigation";
import { useHoverMenu } from "../lib/use-hover-menu";
import { shellMessages } from "./shell-messages";

/** 顶部电商菜单只列出可用的电商工具。 */
export function CommerceNavMenu({ landing }: { landing: boolean }) {
  const { pathname, search } = useAppLocation();
  const navigate = useAppNavigate();
  const menu = useHoverMenu();
  const t = useMessages(shellMessages);
  const toolText = useMessages(workspaceToolMessages);
  const active = pathname === commercePath;
  const selected = commerceToolFromSearch(search).id;

  function openEntry(key: string | number) {
    menu.close();
    const tool = commerceTools.find(({ id }) => id === key);
    if (tool) void navigate(commerceToolHref(tool.id));
  }

  return (
    <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
      <Dropdown.Trigger
        ref={menu.triggerRef}
        className={`nav-row topbar-menu-trigger${active ? " active" : ""}`}
        onHoverStart={(event) => {
          if (event.pointerType === "mouse") menu.openOnHover();
        }}
        onHoverEnd={menu.closeSoon}
      >
        <span className="nav-label">{t.commerce}</span>
        <UiIcon icon={IconChevronDown} size="small" className="topbar-menu-chevron" />
      </Dropdown.Trigger>
      <Dropdown.Popover
        ref={menu.popoverRef}
        className={`topbar-menu header-menu${landing ? " home-header-glass" : ""}`}
        placement="bottom start"
        offset={4}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label={t.commerceTools}
          onAction={openEntry}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
        >
          {commerceTools.map((tool) => (
            <Dropdown.Item
              key={tool.id}
              id={tool.id}
              textValue={tool.id === "replica" ? t.replica : toolText.tools[tool.id].name}
              className="topbar-menu-item"
              data-current={(active && selected === tool.id) || undefined}
            >
              <UiIcon icon={toolIcons[tool.id]} size="navigation" />
              <span>{tool.id === "replica" ? t.replica : toolText.tools[tool.id].name}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
