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
