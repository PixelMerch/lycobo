import { Dropdown } from "@heroui/react";
import { IconCheck, IconChevronRight, IconSparkles } from "@tabler/icons-react";
import { useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useHoverMenu } from "../../../components/use-hover-menu";
import { useStudioStore } from "../studio-state";
import "./creation-navigation.css";

const navigationModels = [
  {
    id: "gpt-image-2",
    cover: "image-2",
    description: "商品展示与日常图片编辑",
    capabilities: "图文生成 · 参考图编辑",
  },
  {
    id: "gpt-image-2.5",
    cover: "image-2-5",
    description: "商业摄影与创意海报",
    capabilities: "文字排版 · 写实画面",
  },
  {
    id: "nano-banana-2.1",
    cover: "banana",
    description: "商品、人像与场景创作",
    capabilities: "场景生成 · 创意表达",
  },
] as const;

/** Expanded navigation separates the targets; a collapsed icon browses on hover. */
export function CreationNavigation({
  collapsed,
  mobile,
  onNavigate,
}: {
  collapsed: boolean;
  mobile: boolean;
  onNavigate: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pressWasOpen = useRef<boolean | null>(null);
  const menu = useHoverMenu(trigger, ".creation-model-menu [role='menuitem']", {
    openDelay: 250,
    closeDelay: 200,
    keepOpenOnHoveredPress: false,
  });
  const activeModel = useStudioStore((s) => s.activeModel);
  const setActiveModel = useStudioStore((s) => s.setActiveModel);
  const navigate = useNavigate();
  const location = useLocation();
  function enterCreation() {
    menu.close();
    onNavigate();
    navigate("/create");
  }
  return (
    <div
      className="creation-nav-row"
      data-active={location.pathname === "/create" || undefined}
      data-collapsed={collapsed || undefined}
      onPointerEnter={menu.triggerProps.onPointerEnter}
      onPointerLeave={menu.triggerProps.onPointerLeave}
    >
      {!collapsed && (
        <RouteLink
          nav
          to="/create"
          aria-label="创作"
          className="nav-row creation-nav-link"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              trigger.current?.focus();
              menu.openFromKeyboard();
            }
          }}
          onClick={() => {
            menu.close();
            onNavigate();
          }}
        >
          <UiIcon icon={IconSparkles} size="default" />
          <span className="nav-label">创作</span>
        </RouteLink>
      )}
      <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
        <Dropdown.Trigger
          ref={trigger}
          className={collapsed ? "nav-row creation-icon-trigger" : "creation-model-trigger"}
          aria-label={collapsed ? "创作" : "浏览模型"}
          aria-current={collapsed && location.pathname === "/create" ? "page" : false}
          {...(collapsed ? { "aria-description": "点击进入创作，悬停或按向下方向键浏览模型" } : {})}
          onPress={() => {
            if (collapsed) enterCreation();
            else if (pressWasOpen.current ?? menu.isOpen) menu.close();
            else menu.onOpenChange(true);
            pressWasOpen.current = null;
          }}
          onPointerDown={() => {
            // Remember the state before React Aria's press/outside handlers run.
            pressWasOpen.current = menu.isOpen;
            menu.triggerProps.onPointerDown();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") pressWasOpen.current = menu.isOpen;
            if (collapsed && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              enterCreation();
              return;
            }
            menu.triggerProps.onKeyDown(event);
          }}
        >
          {collapsed ? (
            <>
              <UiIcon icon={IconSparkles} size="default" />
              <span className="nav-label">创作</span>
            </>
          ) : (
            <UiIcon icon={IconChevronRight} size="small" />
          )}
        </Dropdown.Trigger>
        <Dropdown.Popover
          className="creation-model-menu"
          placement={mobile ? "bottom end" : "right top"}
          offset={12}
          isNonModal
          {...menu.popoverProps}
        >
          <div className="creation-model-heading">选择创作模型</div>
          <Dropdown.Menu
            autoFocus={false}
            onAction={(key) => {
              const model = navigationModels.find((item) => item.id === key);
              if (!model) return;
              setActiveModel(model.id);
              onNavigate();
              navigate("/create");
            }}
          >
            {navigationModels.map((model) => (
              <Dropdown.Item
                key={model.id}
                id={model.id}
                textValue={model.id}
                aria-label={`进入 ${model.id} 创作`}
                className="creation-model-card"
              >
                <img
                  src={`/studio/models/${model.cover}-1.webp`}
                  width="64"
                  height="64"
                  alt=""
                  decoding="async"
                  draggable={false}
                />
                <span className="creation-model-copy">
                  <span className="creation-model-title">{model.id}</span>
                  <span className="creation-model-description">{model.description}</span>
                  <span className="creation-model-capabilities">{model.capabilities}</span>
                </span>
                {activeModel === model.id && (
                  <UiIcon icon={IconCheck} size="small" className="creation-model-current" />
                )}
                {activeModel === model.id && <span className="sr-only">当前模型</span>}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
