import { Dropdown, Tooltip } from "@heroui/react";
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

/** Navigation and model browsing are separate targets; neither submits paid work. */
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
  const menu = useHoverMenu(trigger, ".creation-model-menu [role='menuitem']");
  const activeModel = useStudioStore((s) => s.activeModel);
  const setActiveModel = useStudioStore((s) => s.setActiveModel);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div
      className="creation-nav-row"
      data-active={location.pathname === "/create" || undefined}
      data-collapsed={collapsed || undefined}
    >
      <Tooltip delay={300} isDisabled={!collapsed}>
        <RouteLink
          nav
          to="/create"
          aria-label="创作"
          className="nav-row creation-nav-link"
          onClick={onNavigate}
        >
          <UiIcon icon={IconSparkles} size="default" />
          <span className="nav-label">创作</span>
        </RouteLink>
        <Tooltip.Content placement="right">创作</Tooltip.Content>
      </Tooltip>
      <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
        <Dropdown.Trigger
          ref={trigger}
          className="creation-model-trigger"
          aria-label="浏览模型"
          {...menu.triggerProps}
        >
          <UiIcon icon={IconChevronRight} size="small" />
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
