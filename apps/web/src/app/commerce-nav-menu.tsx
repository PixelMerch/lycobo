import { Dropdown } from "@heroui/react";
import { IconBulb, IconChevronDown } from "@tabler/icons-react";
import { UiIcon } from "../components/ui-icon";
import { inspirationLibraryPath } from "../features/home/inspiration-path";
import {
  shareProductReference,
  visibleWorkspaceTools,
} from "../features/workspace/workspace-state";
import { workspaceToolMessages } from "../features/workspace/workspace-tool-messages";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { useMessages } from "../i18n/messages";
import { useAppLocation, useAppNavigate } from "../i18n/use-localized-navigation";
import { useHoverMenu } from "../lib/use-hover-menu";
import { shellMessages } from "./shell-messages";

/**
 * 顶部栏“电商”入口：鼠标悬停或点击/按键展开创作工具，选中后沿用工具坞只向空图片槽带图的规则。
 * 悬停展开不抢占焦点；移出入口或菜单后短暂延时收起。
 */
export function CommerceNavMenu({
  active,
  tools = visibleWorkspaceTools,
  includeInspiration = false,
}: {
  active: boolean;
  tools?: typeof visibleWorkspaceTools;
  includeInspiration?: boolean;
}) {
  const { pathname } = useAppLocation();
  const navigate = useAppNavigate();
  const menu = useHoverMenu();
  const t = useMessages(shellMessages);
  const toolText = useMessages(workspaceToolMessages);
  function openTool(key: string | number) {
    if (includeInspiration && key === "inspiration") {
      menu.close();
      void navigate(inspirationLibraryPath);
      return;
    }
    const tool = tools.find((item) => item.id === key);
    if (!tool) return;
    menu.close();
    shareProductReference(pathname, tool.path);
    void navigate(tool.path);
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
        className={`topbar-menu header-menu${includeInspiration ? " home-header-glass" : ""}`}
        placement="bottom start"
        offset={4}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label={t.commerceTools}
          onAction={openTool}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
        >
          {tools.map((tool) => (
            <Dropdown.Item
              key={tool.id}
              id={tool.id}
              textValue={toolText.tools[tool.id].name}
              className="topbar-menu-item"
              data-current={pathname === tool.path || undefined}
            >
              <UiIcon icon={toolIcons[tool.id]} size="navigation" />
              <span>{toolText.tools[tool.id].name}</span>
            </Dropdown.Item>
          ))}
          {includeInspiration && (
            <Dropdown.Item id="inspiration" textValue={t.inspiration} className="topbar-menu-item">
              <UiIcon icon={IconBulb} size="navigation" />
              <span>{t.inspiration}</span>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
