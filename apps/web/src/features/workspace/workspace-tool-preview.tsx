import { useMessages } from "../../i18n/messages";
import type { workspaceTools } from "./workspace-state";
import { workspaceToolMessages } from "./workspace-tool-messages";
import "./workspace-tool-preview.css";

type WorkspaceTool = (typeof workspaceTools)[number];

/** 展示工具的示例图片和用途，套图计划与复制爆款使用同一张流程图。 */
export function WorkspaceToolPreview({ tool }: { tool: WorkspaceTool }) {
  const t = useMessages(workspaceToolMessages);
  const showsWorkflow = tool.id === "variation" || tool.id === "replica";
  return (
    <figure className="workspace-tool-preview-card" data-tool={tool.id}>
      <div className="workspace-tool-preview-media" aria-hidden="true">
        {showsWorkflow ? (
          <img
            className="workspace-tool-preview-workflow"
            src={tool.hero}
            alt=""
            decoding="async"
          />
        ) : (
          <>
            <div className="workspace-tool-preview-results">
              {tool.examples.map((src) => (
                <img key={src} src={src} alt="" decoding="async" />
              ))}
            </div>
            <img
              className="workspace-tool-preview-source"
              src={tool.examples[0]}
              alt=""
              decoding="async"
            />
            <span className="workspace-tool-preview-badge">{t.sampleBadge}</span>
          </>
        )}
      </div>
      <figcaption className="workspace-tool-preview-summary">{t.tools[tool.id].summary}</figcaption>
    </figure>
  );
}
