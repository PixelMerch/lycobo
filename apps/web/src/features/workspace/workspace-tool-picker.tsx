import { Button, Dropdown, Header } from "@heroui/react";
import {
  IconBrush,
  IconChevronRight,
  IconFolder,
  IconPhoto,
  IconShirt,
  IconSparkles,
} from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";
import { shellMessages } from "../../app/shell-messages";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { useAppLocation, useAppNavigate } from "../../i18n/use-localized-navigation";
import { freeCanvasPath } from "../../lib/dashboard-paths";
import { useHoverMenu } from "../../lib/use-hover-menu";
import { useOpenAssetLibrary } from "../assets/asset-library-store";
import { inspirationLibraryPath } from "../inspiration/inspiration-path";
import { shareProductReference, visibleWorkspaceTools } from "./workspace-state";
import { type WorkspaceToolCategory, workspaceToolCategories } from "./workspace-tool-categories";
import { workspaceToolMessages } from "./workspace-tool-messages";

const sideDockQuery = "(min-width: 1024px)";
const isSideDock = () => window.matchMedia(sideDockQuery).matches;
const categoryIcons = { productImages: IconPhoto, categoryTools: IconShirt };
function subscribeToDockLayout(change: () => void) {
  const query = window.matchMedia(sideDockQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/** 工作区沿用首页的工具分类，桌面端悬停后向右展开。 */
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
        aria-label={t.navigation.examples}
        onPress={() => void navigate(inspirationLibraryPath)}
      >
        <UiIcon icon={IconSparkles} size="navigation" />
        <span className="workspace-tool-label">{t.navigation.examples}</span>
      </Button>
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
  const t = useMessages(workspaceToolMessages);
  const menu = useHoverMenu();
  const label = t.navigation[category.label];
  const entries = category.sections.flatMap((section) => section.entries);
  const currentTool = visibleWorkspaceTools.find(
    (tool) => tool.path === pathname.replace(/\/+$/, ""),
  );
  const isCurrentCategory = entries.some((entry) => entry.tool === currentTool?.id);

  function selectEntry(key: string | number) {
    const tool = visibleWorkspaceTools.find((item) => item.id === key);
    if (!tool) return;
    menu.close();
    if (tool.id === currentTool?.id) return;
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
        data-current={isCurrentCategory || undefined}
        onHoverStart={(event) => {
          if (!side || event.pointerType !== "mouse") return;
          menu.openOnHover();
          activate();
        }}
        onHoverEnd={menu.closeSoon}
      >
        {isCurrentCategory && <span className="workspace-tool-rail-ripple" aria-hidden="true" />}
        <UiIcon icon={categoryIcons[category.label]} size="navigation" />
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
          onAction={selectEntry}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
        >
          {category.sections.map((section) => (
            <Dropdown.Section key={section.heading} aria-label={t.navigation[section.heading]}>
              <Header className="workspace-tool-section-label">
                {t.navigation[section.heading]}
              </Header>
              {section.entries.map((item) => {
                const name = t.navigation.tools[item.tool];
                return (
                  <Dropdown.Item
                    key={item.tool}
                    id={item.tool}
                    textValue={name}
                    aria-label={name}
                    data-current={item.tool === currentTool?.id || undefined}
                    className="workspace-tool-menu-item"
                  >
                    <span className="workspace-tool-preview-thumb" aria-hidden="true">
                      <img
                        src={item.preview}
                        alt=""
                        width={52}
                        height={36}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className="workspace-tool-menu-copy">
                      <span>{name}</span>
                      <span className="workspace-tool-description">
                        {t.tools[item.tool].summary}
                      </span>
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
