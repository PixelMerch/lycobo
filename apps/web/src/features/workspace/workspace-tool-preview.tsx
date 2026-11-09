import { useMessages } from "../../i18n/messages";
import type { workspaceTools } from "./workspace-state";
import { workspaceToolMessages } from "./workspace-tool-messages";

type WorkspaceTool = (typeof workspaceTools)[number];

/** 工具预览卡：悬停或键盘聚焦时显示示例效果、用途与三步用法。 */
export function WorkspaceToolPreview({ tool, current }: { tool: WorkspaceTool; current: boolean }) {
  const t = useMessages(workspaceToolMessages);
  const text = t.tools[tool.id];
  return (
    <div className="workspace-tool-preview-card" data-tool={tool.id}>
      <div className="workspace-tool-preview-media">
        {tool.examples.map((src) => (
          <img key={src} src={src} alt="" decoding="async" />
        ))}
        <span className="workspace-tool-preview-badge">{t.sampleBadge}</span>
      </div>
      <p className="workspace-tool-preview-title">
        <strong>{text.name}</strong>
        {current && <span className="workspace-tool-preview-current">{t.inUse}</span>}
      </p>
      <p className="workspace-tool-preview-summary">{text.summary}</p>
      <ol className="workspace-tool-preview-steps">
        {text.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {!current && <p className="workspace-tool-preview-hint">{t.switchHint}</p>}
    </div>
  );
}
