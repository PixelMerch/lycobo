import { currentMessages } from "../../../i18n/messages";
import type { ReferenceImage } from "../studio-state";
import { prepareReferenceUpload } from "./prepare-reference-upload";
import { referencesMessages } from "./references-messages";

const maxOriginalSizeMb = 50;
const bytesPerMb = 1024 * 1024;
/** 单张参考图超过大小上限时的提示；没超过时返回 null。 */
export function referenceSizeError(size: number, position: number) {
  if (size <= maxOriginalSizeMb * bytesPerMb) return null;
  const t = currentMessages(referencesMessages);
  const sizeMb = (size / bytesPerMb).toFixed(2);
  const actual =
    Number(sizeMb) > maxOriginalSizeMb ? t.sizeNow(sizeMb) : t.sizeSlightlyOver(maxOriginalSizeMb);
  return t.tooLarge(position, maxOriginalSizeMb, actual);
}

/** 检查选中的文件：第一张超限或格式不支持的图片给出提示，都合格时返回 null。 */
export function referenceFileError(files: File[]) {
  for (const [index, file] of files.entries()) {
    const issue = referenceSizeError(file.size, index + 1);
    if (issue) return issue;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return currentMessages(referencesMessages).unsupportedFormat(index + 1);
  }
  return null;
}

/** 只在浏览器里读取草稿图片，不上传也不保存素材。 */
export async function readReferenceImages(files: File[]): Promise<ReferenceImage[]> {
  // 大图解码时占用的内存可能远大于文件本身。
  const references: ReferenceImage[] = [];
  for (const [index, file] of files.entries()) {
    const prepared = await prepareReferenceUpload(file, index + 1);
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error(currentMessages(referencesMessages).unreadable));
      reader.onerror = () => reject(new Error(currentMessages(referencesMessages).unreadable));
      reader.readAsDataURL(prepared);
    });
    const decoded = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(currentMessages(referencesMessages).unreadable));
      image.src = src;
    });
    const resize = (edge: number, quality: number) => {
      const scale = Math.min(1, edge / decoded.naturalWidth, edge / decoded.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(decoded.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error(currentMessages(referencesMessages).unreadable);
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
