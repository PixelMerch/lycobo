import type { AssetTool } from "@lycoboai/contracts";
import type postgres from "postgres";
export function imageQueryViews(sql: postgres.Sql) {
  const publicModelSql = sql`case when j.model in ('nano-banana-2.1','gemini-nano-banana-2.1') then 'nano-banana-2.1'
    when j.model in ('gpt-image-2.5','gpt-image-2.5-flare','gpt-image-2.5-sunburst') then 'gpt-image-2.5'
    when j.model in ('gpt-image-2','gpt-image-2-4K') then 'gpt-image-2' else j.model end`;
  // A task's tool is recorded by its input: textile and variation inputs carry their own keys.
  function toolMatchSql(tool: AssetTool) {
    if (tool === "video") return sql`j.input ? 'video'`;
    if (tool === "textile") return sql`j.input ? 'textileSet'`;
    if (tool === "variation") return sql`j.input ? 'variation'`;
    return sql`not (j.input ? 'textileSet') and not (j.input ? 'variation') and not (j.input ? 'video')`;
  }
  return { publicModelSql, toolMatchSql };
}
