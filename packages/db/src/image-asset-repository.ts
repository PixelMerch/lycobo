import {
  type AssetType,
  assetFavoriteLimit,
  type ImageScope,
  type StoredImage,
} from "@lycoboai/contracts";
import type postgres from "postgres";
import { recordImageEvent } from "./image-event-repository";
import { imageQueryViews } from "./image-query-views";
import { type AssetFilters, ImageRepositoryError } from "./image-repository-types";
export function imageAssetRepository(sql: postgres.Sql) {
  const { publicModelSql, toolMatchSql } = imageQueryViews(sql);
  const toolSql = sql`case when j.id is null then null when j.input ? 'textileSet' then 'textile'
    when j.input ? 'variation' then 'variation' when j.input ? 'video' then 'video' else 'create' end`;
  const visibleAssetSql = sql`(a.expires_at is null or a.expires_at>now()) and a.storage_deleted_at is null`;
  return {
    async addReference(scope: ImageScope, image: StoredImage) {
      await sql.begin(async (tx) => {
        await tx`insert into media_assets (id,organization_id,user_id,kind,media_type,object_key,mime_type,width,height,bytes,sha256,expires_at)
          values (${image.id},${scope.organizationId},${scope.userId},'reference','image',${image.objectKey},${image.mimeType},${image.width},${image.height},${image.bytes},${image.sha256},now()+interval '3 days')`;
        await recordImageEvent(tx, scope.organizationId, "asset", image.id);
      });
    },
    async listAssets(
      scope: ImageScope,
      limit: number,
      before?: string,
      kind?: "output" | "reference",
      type?: AssetType,
      filters: AssetFilters = {},
    ): Promise<Record<string, unknown>[]> {
      const favorite = sql`exists(select 1 from image_asset_favorites f where f.organization_id=a.organization_id
        and f.user_id=${scope.userId} and f.asset_id=a.id)`;
      return sql`select a.public_id,a.id,a.kind,a.media_type as type,a.width,a.height,a.bytes,a.created_at,j.public_id as task_public_id,${publicModelSql} as model,j.prompt,
        ${toolSql} as tool,${favorite} as favorite,
        (j.input->'video'->>'seconds')::integer as duration_seconds,j.resolution
        from media_assets a left join generation_job_items i on i.output_asset_id=a.id and i.organization_id=a.organization_id
        left join generation_jobs j on j.id=i.job_id and j.organization_id=a.organization_id
        where a.organization_id=${scope.organizationId} and ${visibleAssetSql}
        and (a.media_type<>'video' or ${filters.includeVideo === true})
        ${kind ? sql`and a.kind=${kind}` : sql``}
        ${type ? sql`and a.media_type=${type}` : sql``}
        ${filters.tool ? sql`and j.id is not null and ${toolMatchSql(filters.tool)}` : sql``}
        ${filters.since ? sql`and a.created_at>=${filters.since}::timestamptz` : sql``}
        ${filters.model ? sql`and ${publicModelSql}=${filters.model}` : sql``}
        ${filters.favorite ? sql`and ${favorite}` : sql``}
        ${before ? sql`and (a.created_at,a.id) < (select created_at,id from media_assets where id=${before} and organization_id=${scope.organizationId})` : sql``}
        order by a.created_at desc,a.id desc limit ${limit}`;
    },
    /** Returns the stored state, or null when the asset is not visible to the organization. */
    async setAssetFavorite(scope: ImageScope, assetId: string, favorite: boolean) {
      return sql.begin(async (tx) => {
        const [asset] =
          await tx`select id from media_assets where id=${assetId} and organization_id=${scope.organizationId}
          and (expires_at is null or expires_at>now()) and storage_deleted_at is null`;
        if (!asset) return null;
        if (!favorite) {
          await tx`delete from image_asset_favorites where organization_id=${scope.organizationId}
            and user_id=${scope.userId} and asset_id=${assetId}`;
          return false;
        }
        // One member's favorite writes are serialized so the limit holds under concurrent requests.
        await tx`select pg_advisory_xact_lock(hashtextextended(${`${scope.organizationId}:${scope.userId}`},71421))`;
        const [existing] =
          await tx`select 1 from image_asset_favorites where organization_id=${scope.organizationId}
          and user_id=${scope.userId} and asset_id=${assetId}`;
        if (existing) return true;
        const [count] = await tx`select count(*)::integer as total from image_asset_favorites f
          join media_assets a on a.id=f.asset_id and a.organization_id=f.organization_id
          where f.organization_id=${scope.organizationId} and f.user_id=${scope.userId}
          and (a.expires_at is null or a.expires_at>now()) and a.storage_deleted_at is null`;
        if (Number(count?.total) >= assetFavoriteLimit)
          throw new ImageRepositoryError("STATE_CONFLICT");
        await tx`insert into image_asset_favorites (organization_id,user_id,asset_id)
          values (${scope.organizationId},${scope.userId},${assetId}) on conflict do nothing`;
        return true;
      });
    },
    async favoriteAssetIds(scope: ImageScope) {
      const rows = await sql`select f.asset_id from image_asset_favorites f
        join media_assets a on a.id=f.asset_id and a.organization_id=f.organization_id
        where f.organization_id=${scope.organizationId} and f.user_id=${scope.userId} and ${visibleAssetSql}
        order by f.created_at desc,f.asset_id desc limit ${assetFavoriteLimit}`;
      return rows.map((row) => String(row.asset_id));
    },
    async assetLocations(scope: ImageScope, ids: string[]) {
      if (!ids.length) return [];
      const rows =
        await sql`select id,object_key from media_assets where organization_id=${scope.organizationId} and id in ${sql(ids)} and (expires_at is null or expires_at>now()) and storage_deleted_at is null`;
      return rows.map((row) => ({ id: String(row.id), objectKey: String(row.object_key) }));
    },
    async asset(scope: ImageScope, id: string): Promise<StoredImage | null> {
      const [row] =
        await sql`select id,object_key,mime_type,width,height,bytes,sha256 from media_assets where media_type='image' and id=${id} and organization_id=${scope.organizationId} and (expires_at is null or expires_at>now()) and storage_deleted_at is null`;
      if (!row) return null;
      return {
        id: String(row.id),
        objectKey: String(row.object_key),
        mimeType: "image/png",
        width: Number(row.width),
        height: Number(row.height),
        bytes: Number(row.bytes),
        sha256: String(row.sha256),
      };
    },
    async expiredReferences(): Promise<StoredImage[]> {
      const rows = await sql.begin(async (tx) => {
        const expired = await tx`select id,object_key,width,height,bytes,sha256 from media_assets
          where expires_at<=now() and storage_deleted_at is null order by expires_at,id limit 20 for update skip locked`;
        if (expired.length)
          await tx`update media_assets set cleanup_started_at=coalesce(cleanup_started_at,now()) where id in ${tx(expired.map((row) => String(row.id)))}`;
        return expired;
      });
      return rows.map((row) => ({
        id: String(row.id),
        objectKey: String(row.object_key),
        mimeType: "image/png",
        width: Number(row.width),
        height: Number(row.height),
        bytes: Number(row.bytes),
        sha256: String(row.sha256),
      }));
    },
    async markReferenceDeleted(id: string) {
      await sql`update media_assets set storage_deleted_at=now()
        where id=${id} and expires_at<=now() and storage_deleted_at is null`;
    },
  };
}
