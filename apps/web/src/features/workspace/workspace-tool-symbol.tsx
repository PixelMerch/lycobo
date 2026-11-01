import { IconCamera, IconLayoutCollage, IconWand } from "@tabler/icons-react";
import { useLocation } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { toolForPath, type workspaceTools } from "./workspace-state";

type ToolId = (typeof workspaceTools)[number]["id"];
const toolIcons = { create: IconCamera, textile: IconLayoutCollage, variation: IconWand };

export function WorkspaceToolSymbol({ tool }: { tool: ToolId }) {
  return (
    <span className="workspace-tool-symbol" data-tool={tool} aria-hidden="true">
      <UiIcon icon={toolIcons[tool]} size="navigation" />
    </span>
  );
}

/** The panel opens with the current tool's example photo, name and purpose. */
export function WorkspaceComposerTitle() {
  const { pathname } = useLocation();
  const tool = toolForPath(pathname);
  return (
    <header key={tool.id} className="workspace-composer-hero" data-tool={tool.id}>
      {tool.id === "textile" ? (
        <div className="workspace-composer-hero-collage" aria-hidden="true">
          {tool.examples.map((src) => (
            <img key={src} src={src} alt="" decoding="async" />
          ))}
        </div>
      ) : (
        <img className="workspace-composer-hero-image" src={tool.hero} alt="" decoding="async" />
      )}
      {tool.id === "textile" && <span className="workspace-composer-example">示例效果</span>}
      <div className="workspace-composer-hero-copy">
        <h2 className="workspace-composer-title">{tool.name}</h2>
        <p>{tool.summary}</p>
      </div>
    </header>
  );
}
