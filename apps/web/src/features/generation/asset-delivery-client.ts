import { imageDeliverySchema } from "@lycoboai/contracts";
import { queryClient } from "../../lib/query-client";
import { reusePreviewLinks, samePreview } from "./preview-link-cache";
export const deliveryKey = (id: string) => ["image-delivery", id];
function cacheDelivery(id: string, delivery: unknown) {
  const parsed = imageDeliverySchema.safeParse(delivery);
  if (!parsed.success) return false;
  const previewExpiry = Number(new URL(parsed.data.url).searchParams.get("expires"));
  if (Number.isSafeInteger(previewExpiry) && previewExpiry > 0)
    parsed.data.expires_at = previewExpiry;
  const current = imageDeliverySchema.safeParse(queryClient.getQueryData(deliveryKey(id)));
  if (
    current.success &&
    current.data.expires_at > Date.now() / 1000 + 60 &&
    samePreview(current.data.url, parsed.data.url)
  ) {
    queryClient.setQueryData(deliveryKey(id), {
      ...current.data,
      download_url: parsed.data.download_url,
    });
    return true;
  }
  queryClient.setQueryData(deliveryKey(id), reusePreviewLinks(id, parsed.data));
  return false;
}

function rememberReferenceDeliveries(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [id, delivery] of Object.entries(value)) rememberImageDeliveries({ id, delivery });
}

export function rememberImageDeliveries(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) rememberImageDeliveries(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (
    "id" in value &&
    typeof value.id === "string" &&
    "delivery" in value &&
    cacheDelivery(value.id, value.delivery)
  )
    return;
  if (
    "output_asset_id" in value &&
    typeof value.output_asset_id === "string" &&
    "output_delivery" in value
  )
    rememberImageDeliveries({ id: value.output_asset_id, delivery: value.output_delivery });
  if ("reference_deliveries" in value) rememberReferenceDeliveries(value.reference_deliveries);
  if ("data" in value) rememberImageDeliveries(value.data);
  if ("items" in value) rememberImageDeliveries(value.items);
  if ("job" in value) rememberImageDeliveries(value.job);
}
export function assetContentUrl(id: string, thumbnail = false, download = false) {
  const parsed = imageDeliverySchema.safeParse(queryClient.getQueryData(deliveryKey(id)));
  if (
    parsed.success &&
    parsed.data.expires_at > Date.now() / 1000 &&
    (!download || downloadExpiry(parsed.data) > Date.now() / 1000)
  ) {
    if (download) return parsed.data.download_url;
    return thumbnail ? parsed.data.thumbnail_url : parsed.data.url;
  }
  // Compatibility for old metadata/local tooling: production responds with a signed redirect, never image bytes.
  const path = `/api/v1/image-assets/${id}/content`;
  if (download) return `${path}?download=1`;
  return thumbnail ? `${path}?thumbnail=1` : path;
}

function downloadExpiry(delivery: ReturnType<typeof imageDeliverySchema.parse>) {
  const expires = new URL(delivery.download_url).searchParams.get("expires");
  return expires === null ? delivery.expires_at : Number(expires);
}

export function cachedImageDelivery(id: string, minimumLifetime = 60) {
  const parsed = imageDeliverySchema.safeParse(queryClient.getQueryData(deliveryKey(id)));
  return parsed.success &&
    Math.min(parsed.data.expires_at, downloadExpiry(parsed.data)) >
      Date.now() / 1000 + minimumLifetime
    ? parsed.data
    : null;
}
