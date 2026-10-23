import { imageDeliverySchema } from "@lycoboai/contracts";
import { queryClient } from "../../lib/query-client";
export const deliveryKey = (id: string) => ["image-delivery", id];
export function rememberImageDeliveries(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) rememberImageDeliveries(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  if ("id" in value && typeof value.id === "string" && "delivery" in value) {
    const parsed = imageDeliverySchema.safeParse(value.delivery);
    if (parsed.success) queryClient.setQueryData(deliveryKey(value.id), parsed.data);
  }
  if (
    "output_asset_id" in value &&
    typeof value.output_asset_id === "string" &&
    "output_delivery" in value
  )
    rememberImageDeliveries({ id: value.output_asset_id, delivery: value.output_delivery });
  if (
    "reference_deliveries" in value &&
    value.reference_deliveries &&
    typeof value.reference_deliveries === "object"
  )
    for (const [id, delivery] of Object.entries(value.reference_deliveries))
      rememberImageDeliveries({ id, delivery });
  if ("data" in value) rememberImageDeliveries(value.data);
  if ("items" in value) rememberImageDeliveries(value.items);
  if ("job" in value) rememberImageDeliveries(value.job);
}
export function assetContentUrl(id: string, thumbnail = false, download = false) {
  const parsed = imageDeliverySchema.safeParse(queryClient.getQueryData(deliveryKey(id)));
  if (parsed.success && parsed.data.expires_at > Date.now() / 1000)
    return download
      ? parsed.data.download_url
      : thumbnail
        ? parsed.data.thumbnail_url
        : parsed.data.url;
  // Compatibility for old metadata/local tooling: production responds with a signed redirect, never image bytes.
  return `/api/v1/image-assets/${id}/content${thumbnail ? "?thumbnail=1" : ""}`;
}
