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

export function WorkspaceComposerTitle() {
  const { pathname } = useLocation();
  const tool = toolForPath(pathname);
  return (
    <h2 key={tool.id} className="workspace-composer-title">
      <WorkspaceToolSymbol tool={tool.id} />
      {tool.name}
    </h2>
  );
}
