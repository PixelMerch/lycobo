import type { AssetTool } from "@lycoboai/contracts";
import type postgres from "postgres";
/** 统一模型名称和按任务输入隔离的工具筛选条件。 */
export function imageQueryViews(sql: postgres.Sql) {
  const publicModelSql = sql`case when j.model in ('nano-banana-2.1','gemini-nano-banana-2.1') then 'nano-banana-2.1'
    when j.model in ('gpt-image-2.5','gpt-image-2.5-flare','gpt-image-2.5-sunburst') then 'gpt-image-2.5'
    when j.model in ('gpt-image-2','gpt-image-2-4K') then 'gpt-image-2' else j.model end`;
  // 通过 MCP 单张提交的旧任务保留原始输入，通过来源归入套图。
  const variationSql = sql`(j.input ? 'variation' or j.submission_source is not distinct from 'mcp')`;
  function toolMatchSql(tool: AssetTool) {
    if (tool === "replica") return sql`j.input ? 'replica'`;
    if (tool === "video") return sql`j.input ? 'video'`;
    if (tool === "textile") return sql`j.input ? 'textileSet'`;
    if (tool === "variation") return variationSql;
    return sql`not (j.input ? 'textileSet') and not ${variationSql} and not (j.input ? 'video') and not (j.input ? 'replica')`;
  }
  return { publicModelSql, toolMatchSql, variationSql };
}
