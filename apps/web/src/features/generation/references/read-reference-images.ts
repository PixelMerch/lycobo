import type { ReferenceImage } from "../studio-state";

export function referenceFileError(files: File[]) {
  if (
    files.some(
      (file) =>
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024,
    )
  ) {
    return "请选择 PNG、JPEG 或 WebP 图片，单张不超过 10MB。";
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
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("decode failed"));
        image.src = src;
      });
      return { id: crypto.randomUUID(), name: file.name, src };
    }),
  );
}
