import type { ReferenceImage } from "../studio-state";
import { prepareReferenceUpload } from "./prepare-reference-upload";

const maxOriginalSizeMb = 50;
const bytesPerMb = 1024 * 1024;
const readError = "图片无法读取，请检查文件后重试。";

export function referenceSizeError(size: number, position: number) {
  if (size <= maxOriginalSizeMb * bytesPerMb) return null;
  const sizeMb = (size / bytesPerMb).toFixed(2);
  const actual =
    Number(sizeMb) > maxOriginalSizeMb
      ? `当前为 ${sizeMb} MB`
      : `当前略高于 ${maxOriginalSizeMb} MB`;
  return `第 ${position} 张图片超过单张 ${maxOriginalSizeMb} MB 的上限，${actual}。`;
}

export function referenceFileError(files: File[]) {
  for (const [index, file] of files.entries()) {
    const issue = referenceSizeError(file.size, index + 1);
    if (issue) return issue;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return `第 ${index + 1} 张图片格式不支持，请选择 PNG、JPEG 或 WebP。`;
  }
  return null;
}

/** Browser-only draft decoding; this never uploads or persists an asset. */
export async function readReferenceImages(files: File[]): Promise<ReferenceImage[]> {
  // Large images can allocate much more than their encoded file size while decoding.
  const references: ReferenceImage[] = [];
  for (const [index, file] of files.entries()) {
    const prepared = await prepareReferenceUpload(file, index + 1);
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string" ? resolve(reader.result) : reject(new Error(readError));
      reader.onerror = () => reject(new Error(readError));
      reader.readAsDataURL(prepared);
    });
    const decoded = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(readError));
      image.src = src;
    });
    const resize = (edge: number, quality: number) => {
      const scale = Math.min(1, edge / decoded.naturalWidth, edge / decoded.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(decoded.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error(readError);
      context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", quality);
    };
    references.push({
      id: crypto.randomUUID(),
      name: file.name,
      src,
      thumbnailSrc: resize(512, 0.76),
      previewSrc: resize(1600, 0.82),
    });
  }
  return references;
}
