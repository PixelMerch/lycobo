import type { workspaceTools } from "./workspace-state";

type WorkspaceTool = (typeof workspaceTools)[number];

/** Hover and keyboard-focus preview of a tool: sample results, its purpose and how to use it. */
export function WorkspaceToolPreview({ tool, current }: { tool: WorkspaceTool; current: boolean }) {
  return (
    <div className="workspace-tool-preview-card" data-tool={tool.id}>
      <div className="workspace-tool-preview-media">
        {tool.examples.map((src) => (
          <img key={src} src={src} alt="" decoding="async" />
        ))}
        <span className="workspace-tool-preview-badge">示例效果</span>
      </div>
      <p className="workspace-tool-preview-title">
        <strong>{tool.name}</strong>
        {current && <span className="workspace-tool-preview-current">正在使用</span>}
      </p>
      <p className="workspace-tool-preview-summary">{tool.summary}</p>
      <ol className="workspace-tool-preview-steps">
        {tool.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {!current && <p className="workspace-tool-preview-hint">点击切换到此功能</p>}
    </div>
  );
}
