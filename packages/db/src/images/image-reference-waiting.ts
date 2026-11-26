import type postgres from "postgres";

/** 从持久任务读取尚未入库的参考图，供消费者等待上传处理，调用方不能指定归属。 */
export function imageReferenceWaiting(sql: postgres.Sql) {
  return {
    async waitingReferenceUploads(itemId: string) {
      const [job] = await sql`select j.organization_id,j.user_id,j.created_at,
        array(select value from jsonb_array_elements_text(j.input->'referenceAssetIds') r(value)
          where not exists(select 1 from media_assets a where a.id=r.value::uuid
            and a.organization_id=j.organization_id and a.storage_deleted_at is null)) as ids
        from generation_job_items i join generation_jobs j on j.id=i.job_id
        where i.id=${itemId} and i.status='queued'
          and not exists(select 1 from provider_executions e where e.item_id=i.id and e.phase='polling')`;
      if (!job || !Array.isArray(job.ids) || job.ids.length === 0) return null;
      return {
        organizationId: String(job.organization_id),
        userId: String(job.user_id),
        createdAt: new Date(String(job.created_at)),
        ids: job.ids.map(String),
      };
    },
  };
}
