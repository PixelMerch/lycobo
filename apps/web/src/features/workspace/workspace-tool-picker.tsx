import { Button, Dropdown, Header } from "@heroui/react";
import { IconBrush, IconChevronRight, IconFolder } from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";
import { shellMessages } from "../../app/shell-messages";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { useAppLocation, useAppNavigate } from "../../i18n/use-localized-navigation";
import { useHoverMenu } from "../../lib/use-hover-menu";
import { useOpenAssetLibrary } from "../assets/asset-library-store";
import { freeCanvasPath } from "../free-canvas/free-canvas-path";
import { navigationMessages } from "../home/landing/navigation-messages";
import { shareProductReference, visibleWorkspaceTools } from "./workspace-state";
import { type WorkspaceToolCategory, workspaceToolCategories } from "./workspace-tool-categories";
import { workspaceToolMessages } from "./workspace-tool-messages";

const sideDockQuery = "(min-width: 1024px)";
const isSideDock = () => window.matchMedia(sideDockQuery).matches;
function subscribeToDockLayout(change: () => void) {
  const query = window.matchMedia(sideDockQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/** 首页的三类功能在工作区左侧，桌面端悬停后向右展开。 */
export function WorkspaceToolPicker() {
  const navigate = useAppNavigate();
  const t = useMessages(workspaceToolMessages);
  const shell = useMessages(shellMessages);
  const wideViewport = useSyncExternalStore(subscribeToDockLayout, isSideDock);
  const openLibrary = useOpenAssetLibrary();
  const [openCategory, setOpenCategory] = useState<WorkspaceToolCategory["label"] | null>(null);

  return (
    <nav
      className="workspace-tool-bar"
      aria-label={t.toolBar}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenCategory(null);
      }}
    >
      {workspaceToolCategories.map((category) => (
        <WorkspaceCategoryMenu
          key={category.label}
          category={category}
          active={openCategory === category.label}
          side={wideViewport}
          activate={() => setOpenCategory(category.label)}
        />
      ))}
      <Button
        size="sm"
        variant="tertiary"
        className="workspace-tool-shortcut"
        aria-label={shell.freeCanvas}
        onPress={() => void navigate(freeCanvasPath)}
      >
        <UiIcon icon={IconBrush} size="navigation" />
        <span className="workspace-tool-label">{shell.freeCanvas}</span>
      </Button>
      <Button
        size="sm"
        variant="tertiary"
        className="workspace-tool-shortcut"
        aria-label={shell.assets}
        onPress={() => openLibrary()}
      >
        <UiIcon icon={IconFolder} size="navigation" />
        <span className="workspace-tool-label">{shell.assets}</span>
      </Button>
    </nav>
  );
}

/** 桌面悬停不抢焦点，选择真实目标后才切换工作区。 */
function WorkspaceCategoryMenu({
  category,
  active,
  side,
  activate,
}: {
  category: WorkspaceToolCategory;
  active: boolean;
  side: boolean;
  activate: () => void;
}) {
  const { pathname } = useAppLocation();
  const navigate = useAppNavigate();
  const copy = useMessages(navigationMessages);
  const t = useMessages(workspaceToolMessages);
  const menu = useHoverMenu();
  const label = copy[category.label];
  const entries = category.sections.flatMap((section) => section.entries);
  const currentTool = visibleWorkspaceTools.find((tool) => tool.path === pathname);
  const currentEntry = currentTool && entries.find((entry) => entry.tool === currentTool.id);
  const currentCategory = currentTool?.id === "create" ? "copy001" : "copy003";

  function selectEntry(key: string | number) {
    const entry = entries.find((item) => item.label === key);
    const tool = visibleWorkspaceTools.find((item) => item.id === entry?.tool);
    if (!tool) return;
    menu.close();
    if (tool.path === pathname) return;
    shareProductReference(pathname, tool.path);
    void navigate(tool.path);
  }

  return (
    <Dropdown
      isOpen={active && menu.isOpen}
      onOpenChange={(open) => {
        menu.onOpenChange(open);
        if (open) activate();
      }}
    >
      <Dropdown.Trigger
        ref={menu.triggerRef}
        className="workspace-tool-shortcut workspace-tool-group"
        aria-label={label}
        data-current={(currentTool && category.label === currentCategory) || undefined}
        onHoverStart={(event) => {
          if (!side || event.pointerType !== "mouse") return;
          menu.openOnHover();
          activate();
        }}
        onHoverEnd={menu.closeSoon}
      >
        <UiIcon icon={category.icon} size="navigation" />
        <span className="workspace-tool-label">{label}</span>
        <UiIcon icon={IconChevronRight} size="small" className="workspace-tool-chevron" />
      </Dropdown.Trigger>
      <Dropdown.Popover
        ref={menu.popoverRef}
        className="workspace-tool-submenu"
        data-single-section={category.sections.length === 1 || undefined}
        placement={side ? "right top" : "bottom start"}
        offset={8}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label={label}
          disabledKeys={entries.filter((item) => !item.tool).map((item) => item.label)}
          onAction={selectEntry}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
        >
          {category.sections.map((section) => (
            <Dropdown.Section
              key={section.heading ?? category.label}
              aria-label={section.heading ? copy[section.heading] : label}
              data-wide={section.entries.length > 6 || undefined}
            >
              {section.heading && (
                <Header className="workspace-tool-section-label">{copy[section.heading]}</Header>
              )}
              {section.entries.map((item) => {
                const name = item.label === "styleMatch" ? t.tools.replica.name : copy[item.label];
                const description = item.description
                  ? copy[item.description]
                  : item.tool && t.tools[item.tool].summary;
                return (
                  <Dropdown.Item
                    key={item.label}
                    id={item.label}
                    textValue={name}
                    aria-label={name}
                    data-current={item === currentEntry || undefined}
                    className="workspace-tool-menu-item"
                  >
                    <span className="workspace-tool-menu-copy">
                      <span>{name}</span>
                      {description && (
                        <span className="workspace-tool-description">{description}</span>
                      )}
                    </span>
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Section>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
