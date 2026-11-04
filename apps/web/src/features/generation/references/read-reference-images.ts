import { imageLimits } from "@lycoboai/contracts";
import type { ReferenceImage } from "../studio-state";

export function referenceSizeError(size: number, position: number) {
  if (size <= imageLimits.uploadBytes) return null;
  const sizeMb = (size / (1024 * 1024)).toFixed(2);
  const actual = Number(sizeMb) > 10 ? `当前为 ${sizeMb} MB` : "当前略高于 10 MB";
  return `第 ${position} 张图片超过单张 10 MB 的上限，${actual}。`;
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
  return Promise.all(
    files.map(async (file) => {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("invalid image"));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const decoded = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("decode failed"));
        image.src = src;
      });
      const resize = (edge: number, quality: number) => {
        const scale = Math.min(1, edge / decoded.naturalWidth, edge / decoded.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(decoded.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(decoded.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Preview rendering unavailable");
        context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", quality);
      };
      return {
        id: crypto.randomUUID(),
        name: file.name,
        src,
        thumbnailSrc: resize(512, 0.76),
        previewSrc: resize(1600, 0.82),
      };
    }),
  );
}
