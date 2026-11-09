import { imageDeliverySchema } from "@lycoboai/contracts";
import { currentMessages } from "../../i18n/messages";
import { cachedImageDelivery, rememberImageDeliveries } from "./asset-delivery-client";
import { imageRequest } from "./generation-client";
import { generationMessages } from "./generation-messages";

/** 准备下载链接：已有的元数据自带授权，只补齐缺失或快过期的链接。 */
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
    const t = currentMessages(generationMessages);
    if (!result || typeof result !== "object" || !("data" in result) || !Array.isArray(result.data))
      throw new Error(t.invalidLinkResponse);
    for (const item of result.data) {
      if (
        !item ||
        typeof item !== "object" ||
        !("id" in item) ||
        typeof item.id !== "string" ||
        !batch.includes(item.id) ||
        !("delivery" in item)
      )
        throw new Error(t.invalidLinkResponse);
      rememberImageDeliveries({ id: item.id, delivery: imageDeliverySchema.parse(item.delivery) });
    }
    if (batch.some((id) => !cachedImageDelivery(id))) throw new Error(t.imageUnavailable);
  }
}

/** 取得单张图片的下载链接。 */
export async function resolveDownloadDelivery(id: string, signal: AbortSignal) {
  await prepareDownloadDeliveries([id], signal);
  const delivery = cachedImageDelivery(id);
  if (!delivery) throw new Error(currentMessages(generationMessages).downloadLinkExpired);
  return delivery;
}
