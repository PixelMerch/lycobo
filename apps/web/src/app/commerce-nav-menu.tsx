import { Dropdown } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { UiIcon } from "../components/ui-icon";
import { shareProductReference, workspaceTools } from "../features/workspace/workspace-state";
import { workspaceToolMessages } from "../features/workspace/workspace-tool-messages";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { useMessages } from "../i18n/messages";
import { useHoverMenu } from "../lib/use-hover-menu";
import { shellMessages } from "./shell-messages";

/** 顶部栏“电商”入口：展开四个创作工具，选中后进入工具，并沿用工具坞只向空图片槽带图的规则。 */
export function CommerceNavMenu({ active }: { active: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const menu = useHoverMenu();
  const t = useMessages(shellMessages);
  const toolText = useMessages(workspaceToolMessages);
  function openTool(key: string | number) {
    const tool = workspaceTools.find((item) => item.id === key);
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
        className="topbar-menu header-menu"
        placement="bottom start"
        offset={4}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label={t.commerceTools}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
          onAction={openTool}
        >
          {workspaceTools.map((tool) => (
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
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
