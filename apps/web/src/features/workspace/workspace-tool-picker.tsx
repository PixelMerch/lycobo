import { Button, CloseButton, Dropdown, Header, Tooltip } from "@heroui/react";
import {
  IconBrush,
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconPhoto,
  IconShirt,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { shellMessages } from "../../app/shell-messages";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { useAppLocation, useAppNavigate } from "../../i18n/use-localized-navigation";
import { freeCanvasPath } from "../../lib/dashboard-paths";
import { useOpenAssetLibrary } from "../assets/asset-library-store";
import { inspirationLibraryPath } from "../inspiration/inspiration-path";
import { workspaceRailLabelStyle } from "./workspace-rail-motion";
import { shareProductReference, visibleWorkspaceTools } from "./workspace-state";
import { type WorkspaceToolCategory, workspaceToolCategories } from "./workspace-tool-categories";
import { workspaceToolMessages } from "./workspace-tool-messages";
import { useWorkspaceView } from "./workspace-view-preferences";

const sideDockQuery = "(min-width: 1024px)";
const isSideDock = () => window.matchMedia(sideDockQuery).matches;
const categoryIcons = { productImages: IconPhoto, categoryTools: IconShirt };
const firstShortcutIndex = workspaceToolCategories.length;
function subscribeToDockLayout(change: () => void) {
  const query = window.matchMedia(sideDockQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/** 工作区沿用首页的工具分类，通过点击或键盘展开。 */
export function WorkspaceToolPicker() {
  const navigate = useAppNavigate();
  const t = useMessages(workspaceToolMessages);
  const shell = useMessages(shellMessages);
  const wideViewport = useSyncExternalStore(subscribeToDockLayout, isSideDock);
  const collapsed = useWorkspaceView((state) => state.toolRailCollapsed);
  const showShortcutTooltips = wideViewport && collapsed;
  const openLibrary = useOpenAssetLibrary();
  const [openCategory, setOpenCategory] = useState<WorkspaceToolCategory["label"] | null>(null);
  const shortcuts = [
    {
      id: "examples",
      icon: IconSparkles,
      label: t.navigation.examples,
      action: () => void navigate(inspirationLibraryPath),
    },
    {
      id: "canvas",
      icon: IconBrush,
      label: shell.freeCanvas,
      action: () => void navigate(freeCanvasPath),
    },
    { id: "assets", icon: IconFolder, label: shell.assets, action: () => openLibrary() },
  ];

  return (
    <nav id="workspace-tool-navigation" className="workspace-tool-bar" aria-label={t.toolBar}>
      {workspaceToolCategories.map((category, index) => (
        <WorkspaceCategoryMenu
          key={category.label}
          category={category}
          isOpen={openCategory === category.label}
          side={wideViewport}
          index={index}
          setOpenCategory={setOpenCategory}
        />
      ))}
      {shortcuts.map(({ id, icon, label, action }, index) => (
        <Tooltip key={id} delay={300} closeDelay={0} isDisabled={!showShortcutTooltips}>
          <Button
            size="sm"
            variant="tertiary"
            className="workspace-tool-shortcut"
            style={workspaceRailLabelStyle(firstShortcutIndex + index)}
            aria-label={label}
            onPress={action}
          >
            <UiIcon icon={icon} size="navigation" />
            <span className="workspace-tool-label">{label}</span>
          </Button>
          <Tooltip.Content placement="right" offset={8}>
            {label}
          </Tooltip.Content>
        </Tooltip>
      ))}
    </nav>
  );
}

/** 使用同一个菜单入口处理指针和键盘操作，选择工具后切换工作区。 */
function WorkspaceCategoryMenu({
  category,
  isOpen,
  side,
  index,
  setOpenCategory,
}: {
  category: WorkspaceToolCategory;
  isOpen: boolean;
  side: boolean;
  index: number;
  setOpenCategory: React.Dispatch<React.SetStateAction<WorkspaceToolCategory["label"] | null>>;
}) {
  const { pathname } = useAppLocation();
  const navigate = useAppNavigate();
  const t = useMessages(workspaceToolMessages);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const label = t.navigation[category.label];
  const entries = category.sections.flatMap((section) => section.entries);
  const currentTool = visibleWorkspaceTools.find(
    (tool) => tool.path === pathname.replace(/\/+$/, ""),
  );
  const isCurrentCategory = entries.some((entry) => entry.tool === currentTool?.id);

  useEffect(() => {
    if (!isOpen) return;
    // 非模态菜单允许继续操作工作台，补上点按空白处收起。
    function dismissOutside(event: PointerEvent) {
      const path = event.composedPath();
      if (triggerRef.current && path.includes(triggerRef.current)) return;
      if (popoverRef.current && path.includes(popoverRef.current)) return;
      setOpenCategory((current) => (current === category.label ? null : current));
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [category.label, isOpen, setOpenCategory]);

  function selectEntry(key: string | number) {
    const tool = visibleWorkspaceTools.find((item) => item.id === key);
    if (!tool) return;
    if (tool.id === currentTool?.id) return;
    shareProductReference(pathname, tool.path);
    void navigate(tool.path);
  }

  return (
    <Dropdown
      isOpen={isOpen}
      onOpenChange={(nextOpen) =>
        setOpenCategory((current) => {
          if (nextOpen) return category.label;
          return current === category.label ? null : current;
        })
      }
    >
      <Dropdown.Trigger
        ref={triggerRef}
        className="workspace-tool-shortcut workspace-tool-group"
        style={workspaceRailLabelStyle(index)}
        aria-label={label}
        data-current={isCurrentCategory || undefined}
        onPointerDownCapture={(event) => {
          if (!isOpen || event.button !== 0 || event.pointerType === "touch") return;
          // 菜单默认会在鼠标或触控笔按下时打开，重复点击时先收起。
          event.preventDefault();
          event.stopPropagation();
          setOpenCategory(null);
        }}
      >
        {isCurrentCategory && <span className="workspace-tool-rail-ripple" aria-hidden="true" />}
        <UiIcon icon={categoryIcons[category.label]} size="navigation" />
        <span className="workspace-tool-label">{label}</span>
        <span className="workspace-tool-chevron">
          <UiIcon icon={side ? IconChevronRight : IconChevronDown} size="small" />
        </span>
      </Dropdown.Trigger>
      <Dropdown.Popover
        ref={popoverRef}
        className="workspace-tool-submenu"
        data-single-section={category.sections.length === 1 || undefined}
        placement={side ? "right top" : "bottom start"}
        offset={8}
        isNonModal
      >
        <Dropdown.Menu aria-label={label} onAction={selectEntry}>
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
                    data-tool={item.tool}
                    data-current={item.tool === currentTool?.id || undefined}
                    className="workspace-tool-menu-item"
                  >
                    <span className="workspace-tool-preview-thumb" aria-hidden="true">
                      <img
                        src={item.preview}
                        alt=""
                        width={72}
                        height={50}
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
        <CloseButton
          className="workspace-tool-submenu-close"
          aria-label={t.closeToolMenu}
          onPress={() => {
            setOpenCategory(null);
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <UiIcon icon={IconX} size="default" />
        </CloseButton>
      </Dropdown.Popover>
    </Dropdown>
  );
}
