import type { ImageScope } from "@lycoboai/contracts";
import type postgres from "postgres";
import { recordImageEvent } from "./image-event-repository";
import { imageQueryViews } from "./image-query-views";
import { ImageRepositoryError } from "./image-repository-types";
import type { imageSettlement } from "./image-settlement";
/** 按组织与工具读取、归档图片历史。 */
export function imageHistoryRepository(
  sql: postgres.Sql,
  expireTimedOut: ReturnType<typeof imageSettlement>["expireTimedOut"],
) {
  const { publicModelSql, toolMatchSql } = imageQueryViews(sql);
  const jobView = sql`j.public_id,j.id,j.organization_id,j.user_id,${publicModelSql} as model,j.prompt,j.resolution,j.aspect_ratio,
    j.requested_count,j.unit_credits,j.status,j.input,j.created_at,j.updated_at,j.completed_at,
    (select coalesce(json_agg(json_build_object('id',i.id,'position',i.position,'status',i.status,
      'worker_id',i.worker_id,'provider',i.provider,'provider_request_id',i.provider_request_id,
      'attempts',i.attempts,'error_code',i.error_code,'started_at',i.started_at,'completed_at',i.completed_at,
      'output_asset_id',i.output_asset_id,'output_public_id',a.public_id,'width',a.width,'height',a.height,'bytes',a.bytes) order by i.position),'[]')
      from generation_job_items i left join media_assets a on a.id=i.output_asset_id and a.organization_id=i.organization_id where i.job_id=j.id and i.superseded_at is null) as items`;
  return {
    async list(
      scope: ImageScope,
      limit: number,
      before?: string,
      tool?: "create" | "textile" | "variation" | "replica",
    ) {
      await expireTimedOut(scope.organizationId);
      return sql`select ${jobView} from generation_jobs j where j.organization_id=${scope.organizationId} and j.archived_at is null and not (j.input ? 'video')
        ${tool ? sql`and ${toolMatchSql(tool)}` : sql``}
        ${before ? sql`and (j.created_at,j.id) < (select created_at,id from generation_jobs where id=${before} and organization_id=${scope.organizationId})` : sql``}
        order by j.created_at desc,j.id desc limit ${limit}`;
    },
    async archive(scope: ImageScope, id: string) {
      return sql.begin(async (tx) => {
        const rows = await tx`update generation_jobs set archived_at=coalesce(archived_at,now())
          where id=${id} and organization_id=${scope.organizationId} returning id`;
        if (!rows.length) throw new ImageRepositoryError("NOT_FOUND");
        await recordImageEvent(tx, scope.organizationId, "task", id);
      });
    },
    async getMany(scope: ImageScope, ids: string[]): Promise<Record<string, unknown>[]> {
      await expireTimedOut(scope.organizationId);
      if (!ids.length || ids.length > 50) throw new ImageRepositoryError("STATE_CONFLICT");
      return sql`select ${jobView}, exists(select 1 from generation_job_items i join provider_executions e on e.item_id=i.id
        where i.job_id=j.id and i.superseded_at is null and i.status='running' and e.phase='polling' and e.next_poll_at<=now()
        and (e.lease_until is null or e.lease_until<now())) as recovery_due
        from generation_jobs j where j.id in ${sql(ids)} and j.organization_id=${scope.organizationId} and not (j.input ? 'video')
        and exists(select 1 from organization_members where organization_id=j.organization_id and user_id=${scope.userId})`;
    },
    async get(scope: ImageScope, id: string) {
      await expireTimedOut(scope.organizationId);
      const [row] =
        await sql`select ${jobView} from generation_jobs j where j.id=${id} and j.organization_id=${scope.organizationId} and not (j.input ? 'video')`;
      return row ?? null;
    },
    async latestEdit(scope: ImageScope, sourceId: string) {
      const [source] =
        await sql`select id from media_assets where id=${sourceId} and organization_id=${scope.organizationId}`;
      if (!source) throw new ImageRepositoryError("NOT_FOUND");
      const [row] = await sql`select ${jobView} from image_local_edits e
        join generation_jobs j on j.id=e.job_id and j.organization_id=e.organization_id
        where e.organization_id=${scope.organizationId} and e.user_id=${scope.userId} and e.source_asset_id=${sourceId}
        order by e.created_at desc,e.job_id desc limit 1`;
      return row ?? null;
    },
  };
}
