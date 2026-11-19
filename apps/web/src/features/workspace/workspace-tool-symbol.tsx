import { Tooltip } from "@heroui/react";
import {
  IconArrowRight,
  IconCamera,
  IconCopy,
  IconLayoutCollage,
  IconMovie,
  IconWand,
} from "@tabler/icons-react";
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

/** 参数面板显示工具用途，主图制作直接展示同一商品的原图与成图。 */
export function WorkspaceComposerTitle() {
  const { pathname } = useAppLocation();
  const tool = toolForPath(pathname);
  const heroRef = useComposerHeroScroll(tool.id);
  const t = useMessages(workspaceToolMessages);
  const text = t.tools[tool.id];
  if (tool.id === "create") {
    const example = t.mainImageExample;
    return (
      <div
        ref={heroRef}
        className="workspace-composer-hero workspace-composer-hero--comparison"
        data-tool={tool.id}
      >
        <h2 className="workspace-composer-title">{text.name}</h2>
        <figure className="workspace-composer-comparison" aria-label={example.label}>
          <img
            src="/landing/showcase/mint-throw-source.webp"
            width={760}
            height={760}
            alt={example.sourceAlt}
            decoding="async"
          />
          <UiIcon icon={IconArrowRight} size="small" />
          <img
            src="/landing/showcase/mint-throw-sofa.webp"
            width={760}
            height={760}
            alt={example.resultAlt}
            decoding="async"
          />
          <figcaption>
            <p aria-hidden="true">
              <span>{example.source}</span>
              <span>{example.result}</span>
            </p>
          </figcaption>
        </figure>
      </div>
    );
  }
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
