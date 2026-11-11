import {
  imageUploadResponseSchema,
  imageUploadStatusSchema,
  imageUploadTicketSchema,
} from "@lycoboai/contracts";
import { currentMessages } from "../../../i18n/messages";
import { ImageApiError, imageRequest } from "../image-request";
import { referencesMessages } from "./references-messages";

/** 等参考图真正存好后再返回素材，提交流程只使用已持久化的素材 id。 */
export async function completeReferenceUpload(response: Response) {
  const payload: unknown = await response.json();
  if (response.status !== 202) return imageUploadResponseSchema.parse(payload);
  const { uploadId } = imageUploadTicketSchema.parse(payload);
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const result = imageUploadStatusSchema.parse(
      await (await imageRequest(`image-uploads/${uploadId}`)).json(),
    );
    if (result.status === "succeeded") return result.asset;
    if (result.status === "failed")
      throw new ImageApiError(
        currentMessages(referencesMessages).processingFailed,
        400,
        "INVALID_IMAGE",
      );
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
  throw new ImageApiError(
    currentMessages(referencesMessages).stillProcessing,
    503,
    "UPLOAD_PENDING",
  );
}
