import {
  imageUploadResponseSchema,
  imageUploadStatusSchema,
  imageUploadTicketSchema,
} from "@lycoboai/contracts";
import { ImageApiError, imageRequest } from "../image-request";

/** The existing submit flow waits for a real, persisted asset before using its ID. */
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
        "参考图处理失败，请重新导出为 PNG、JPEG 或 WebP 后重试。",
        400,
        "INVALID_IMAGE",
      );
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
  throw new ImageApiError("参考图仍在处理中，请稍后在素材库查看后重试。", 503, "UPLOAD_PENDING");
}
