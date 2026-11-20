import { IconCamera, IconCopy, IconLayoutCollage, IconMovie, IconWand } from "@tabler/icons-react";
import { useMessages } from "../../i18n/messages";
import { useAppLocation } from "../../i18n/use-localized-navigation";
import { useComposerHeroScroll } from "./use-composer-hero-scroll";
import { toolForPath, type workspaceTools } from "./workspace-state";
import { workspaceToolMessages } from "./workspace-tool-messages";

type ToolId = (typeof workspaceTools)[number]["id"];
/** 工作区工具与素材库功能筛选共用的业务图标。 */
export const toolIcons = {
  create: IconCamera,
  textile: IconLayoutCollage,
  variation: IconWand,
  replica: IconCopy,
  video: IconMovie,
};

/** 用横幅内的示例图和文字说明当前工具的用途。 */
export function WorkspaceComposerTitle() {
  const { pathname } = useAppLocation();
  const tool = toolForPath(pathname);
  const heroRef = useComposerHeroScroll(tool.id);
  const t = useMessages(workspaceToolMessages);
  const text = t.tools[tool.id];
  const artworkAlt: Partial<Record<ToolId, string>> = {
    create: t.mainImageExampleAlt,
    variation: t.imageSetExampleAlt,
    replica: t.styleMatchExampleAlt,
  };
  return (
    <header className="workspace-composer-hero" data-tool={tool.id}>
      {tool.id === "textile" ? (
        <div
          className="workspace-composer-hero-collage"
          role="img"
          aria-label={t.textileExampleAlt}
        >
          {tool.bannerImages.map((src) => (
            <img
              className="workspace-composer-hero-image"
              key={src}
              src={src}
              alt=""
              decoding="async"
            />
          ))}
        </div>
      ) : (
        <img
          className="workspace-composer-hero-image"
          src={tool.hero}
          alt={artworkAlt[tool.id] ?? ""}
          decoding="async"
        />
      )}
      <div ref={heroRef} className="workspace-composer-hero-copy">
        <h2 className="workspace-composer-title">{text.name}</h2>
        <p>{text.summary}</p>
      </div>
    </header>
  );
}
