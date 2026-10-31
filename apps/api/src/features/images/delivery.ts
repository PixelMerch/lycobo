import { type ImageScope, imageJobSchema } from "@lycoboai/contracts";
import type { ImageRuntimeRepository } from "@lycoboai/db";
import type { assetDeliverySigner } from "@lycoboai/storage/delivery";
import { z } from "zod";

const jobDeliverySchema = imageJobSchema.passthrough().extend({
  created_at: z.preprocess(
    (value) => (value instanceof Date ? value.toISOString() : value),
    imageJobSchema.shape.created_at,
  ),
  completed_at: z.preprocess(
    (value) => (value instanceof Date ? value.toISOString() : value),
    imageJobSchema.shape.completed_at,
  ),
  items: imageJobSchema.shape.items.element.passthrough().array(),
});
export type DeliverySigner = ReturnType<typeof assetDeliverySigner>;
export function imageDeliveries(
  repository: Pick<ImageRuntimeRepository, "assetLocations">,
  sign: DeliverySigner,
) {
  const links = async (scope: ImageScope, ids: string[]) => {
    const locations = await repository.assetLocations(scope, [...new Set(ids)]);
    return new Map(
      await Promise.all(
        locations.map(async (asset) => [asset.id, await sign(asset.objectKey)] as const),
      ),
    );
  };
  return {
    async jobs(scope: ImageScope, rows: unknown[]) {
      const jobs = rows.map((row) => jobDeliverySchema.parse(row));
      const deliveries = await links(
        scope,
        jobs.flatMap((job) => [
          ...(job.input?.referenceAssetIds ?? []),
          ...job.items.flatMap((item) => (item.output_asset_id ? [item.output_asset_id] : [])),
        ]),
      );
      return jobs.map((job) => ({
        ...job,
        reference_deliveries: Object.fromEntries(
          (job.input?.referenceAssetIds ?? []).flatMap((id) => {
            const delivery = deliveries.get(id);
            return delivery ? [[id, delivery]] : [];
          }),
        ),
        items: job.items.map((item) => ({
          ...item,
          ...(item.output_asset_id && deliveries.has(item.output_asset_id)
            ? { output_delivery: deliveries.get(item.output_asset_id) }
            : {}),
        })),
      }));
    },
    async assets(scope: ImageScope, rows: unknown[]) {
      const assets = rows.map((row) => z.object({ id: z.uuid() }).passthrough().parse(row));
      const deliveries = await links(
        scope,
        assets.map((row) => row.id),
      );
      return assets.map((row) => ({ ...row, delivery: deliveries.get(row.id) }));
    },
  };
}
