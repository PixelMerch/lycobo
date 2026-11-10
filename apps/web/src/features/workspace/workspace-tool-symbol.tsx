import { Tooltip } from "@heroui/react";
import { IconCamera, IconCopy, IconLayoutCollage, IconMovie, IconWand } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { useAppLocation } from "../../i18n/use-localized-navigation";
import { useComposerHeroScroll } from "./use-composer-hero-scroll";
import { toolForPath, type workspaceTools } from "./workspace-state";
import { workspaceToolMessages } from "./workspace-tool-messages";
import { WorkspaceToolPreview } from "./workspace-tool-preview";

type ToolId = (typeof workspaceTools)[number]["id"];
/** 工作区工具与素材库功能筛选共用的业务图标。 */
export const toolIcons = {
  create: IconCamera,
  textile: IconLayoutCollage,
  variation: IconWand,
  replica: IconCopy,
  video: IconMovie,
};

/** 工具入口使用统一线性图标，颜色由当前状态决定。 */
export function WorkspaceToolSymbol({ tool }: { tool: ToolId }) {
  return (
    <span className="workspace-tool-symbol" data-tool={tool} aria-hidden="true">
      <UiIcon icon={toolIcons[tool]} size="navigation" />
    </span>
  );
}

/** 参数面板顶部的工具标题：当前工具的示例图、名称与用途，悬停时显示预览卡。 */
export function WorkspaceComposerTitle() {
  const { pathname } = useAppLocation();
  const tool = toolForPath(pathname);
  const heroRef = useComposerHeroScroll(tool.id);
  const t = useMessages(workspaceToolMessages);
  const text = t.tools[tool.id];
  return (
    <Tooltip key={tool.id} delay={350} closeDelay={80}>
      <Tooltip.Trigger
        className="workspace-composer-hero"
        data-tool={tool.id}
        aria-label={t.usageGuide(text.name)}
      >
        {tool.id === "textile" ? (
          <div className="workspace-composer-hero-collage" aria-hidden="true">
            {tool.bannerImages.map((src) => (
              <img key={src} src={src} alt="" decoding="async" />
            ))}
          </div>
        ) : (
          <img className="workspace-composer-hero-image" src={tool.hero} alt="" decoding="async" />
        )}
        <div ref={heroRef} className="workspace-composer-hero-copy">
          <h2 className="workspace-composer-title">{text.name}</h2>
          <p>{text.summary}</p>
        </div>
      </Tooltip.Trigger>
      <Tooltip.Content placement="right top" offset={10} className="workspace-tool-preview">
        <WorkspaceToolPreview tool={tool} />
      </Tooltip.Content>
    </Tooltip>
  );
}
