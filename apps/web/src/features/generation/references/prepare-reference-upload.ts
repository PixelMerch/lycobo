// 限制上传副本以减少网络传输，原文件大小由独立规则校验。
const transportLimit = 5 * 1024 * 1024;
const referenceEdge = 3840;
const targetBytes = 1024 * 1024;

/** 为所有参考图生成保留透明度的压缩副本，不放大图片或替换更小的原文件。 */
export async function prepareReferenceUpload(original: Blob, position: number): Promise<Blob> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(original);
  } catch {
    throw new Error(`第 ${position} 张图片无法解码，请重新导出为 PNG、JPEG 或 WebP 后重试。`);
  }
  try {
    const edge = Math.max(image.width, image.height);
    const smallest = await compressReference(image);
    if (
      edge <= referenceEdge &&
      original.size <= transportLimit &&
      smallest &&
      original.size <= smallest.size
    )
      return original;
    if (smallest && smallest.size <= transportLimit) return smallest;
  } catch {
    // 统一提示也覆盖浏览器无法编码该格式的情况。
  } finally {
    image.close();
  }
  throw new Error(`第 ${position} 张图片无法压缩到可上传的大小，请缩小图片后重试。`);
}

async function compressReference(image: ImageBitmap) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const edge = Math.max(image.width, image.height);
  let scale = Math.min(1, referenceEdge / edge);
  let smallest: Blob | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const quality = attempt === 0 ? 0.85 : 0.78;
    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (encoded?.size && (!smallest || encoded.size < smallest.size)) smallest = encoded;
    if (encoded?.size && encoded.size <= targetBytes) break;
    scale *= 0.75;
  }
  return smallest;
}
