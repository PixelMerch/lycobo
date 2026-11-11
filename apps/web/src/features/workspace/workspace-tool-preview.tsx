import { useMessages } from "../../i18n/messages";
import type { workspaceTools } from "./workspace-state";
import { workspaceToolMessages } from "./workspace-tool-messages";
import "./workspace-tool-preview.css";

type WorkspaceTool = (typeof workspaceTools)[number];

/** 用商品示例从单图展开成多图，预览只演示用途，不表示真实任务结果。 */
export function WorkspaceToolPreview({ tool }: { tool: WorkspaceTool }) {
  const t = useMessages(workspaceToolMessages);
  return (
    <figure className="workspace-tool-preview-card" data-tool={tool.id}>
      <div className="workspace-tool-preview-media" aria-hidden="true">
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
      </div>
      <figcaption className="workspace-tool-preview-summary">{t.tools[tool.id].summary}</figcaption>
    </figure>
  );
}
