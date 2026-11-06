// 限制上传副本以减少网络传输，原文件大小由独立规则校验。
const transportLimit = 5 * 1024 * 1024;
const referenceEdge = 3840;

/** 将较大的参考图转为保留透明度的上传副本，原文件保持在浏览器本地。 */
export async function prepareReferenceUpload(original: Blob, position: number): Promise<Blob> {
  if (original.size <= transportLimit) return original;
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(original);
  } catch {
    throw new Error(`第 ${position} 张图片无法解码，请重新导出为 PNG、JPEG 或 WebP 后重试。`);
  }
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    const edge = Math.max(image.width, image.height);
    let scale = Math.min(1, referenceEdge / edge);
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = attempt === 0 ? 0.95 : 0.86;
      const encoded = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (encoded?.size && encoded.size <= transportLimit) return encoded;
      scale *= 0.75;
    }
  } catch {
    // 统一提示也覆盖浏览器无法编码该格式的情况。
  } finally {
    image.close();
  }
  throw new Error(`第 ${position} 张图片无法压缩到可上传的大小，请缩小图片后重试。`);
}
