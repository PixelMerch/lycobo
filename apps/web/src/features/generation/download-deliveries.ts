import { imageDeliverySchema } from "@lycoboai/contracts";
import { cachedImageDelivery, rememberImageDeliveries } from "./asset-delivery-client";
import { imageRequest } from "./generation-client";

/** Existing metadata already contains scoped capabilities; refresh only missing/expiring links. */
export async function prepareDownloadDeliveries(ids: string[], signal: AbortSignal) {
  const missing = [...new Set(ids)].filter((id) => !cachedImageDelivery(id));
  for (let offset = 0; offset < missing.length; offset += 100) {
    const batch = missing.slice(offset, offset + 100);
    const result: unknown = await (
      await imageRequest("image-assets/deliveries", {
        method: "POST",
        body: JSON.stringify({ ids: batch }),
        signal,
      })
    ).json();
    if (!result || typeof result !== "object" || !("data" in result) || !Array.isArray(result.data))
      throw new Error("图片链接响应无效。");
    for (const item of result.data) {
      if (
        !item ||
        typeof item !== "object" ||
        !("id" in item) ||
        typeof item.id !== "string" ||
        !batch.includes(item.id) ||
        !("delivery" in item)
      )
        throw new Error("图片链接响应无效。");
      rememberImageDeliveries({ id: item.id, delivery: imageDeliverySchema.parse(item.delivery) });
    }
    if (batch.some((id) => !cachedImageDelivery(id))) throw new Error("图片已失效或无权下载。");
  }
}

export async function resolveDownloadDelivery(id: string, signal: AbortSignal) {
  await prepareDownloadDeliveries([id], signal);
  const delivery = cachedImageDelivery(id);
  if (!delivery) throw new Error("图片下载链接已失效。");
  return delivery;
}
