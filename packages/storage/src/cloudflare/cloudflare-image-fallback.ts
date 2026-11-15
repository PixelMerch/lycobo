import type { ImageOutputSize } from "../images/core";

// 四百万像素的 RGBA 数据约 16 MiB，为 Worker 保留解码、缩放和编码的内存空间。
const maxPixels = 2048 * 2048;

/** Images 额度用完时，在 Worker 内转换已校验的中小图片。 */
export async function encodeWithoutImages(
  bytes: Uint8Array,
  sourceSize: ImageOutputSize,
  targetSize: ImageOutputSize | undefined,
  format: "image/png" | "image/webp",
) {
  const { width, height } = sourceSize;
  if (width * height > maxPixels) return undefined;
  const { PhotonImage, SamplingFilter, resize } = await import("@cf-wasm/photon");
  const source = PhotonImage.new_from_byteslice(bytes);
  try {
    const scale = targetSize
      ? Math.min(1, targetSize.width / width, targetSize.height / height)
      : 1;
    const output =
      scale < 1
        ? resize(
            source,
            Math.max(1, Math.round(width * scale)),
            Math.max(1, Math.round(height * scale)),
            SamplingFilter.Triangle,
          )
        : source;
    try {
      return format === "image/webp" ? output.get_bytes_webp() : output.get_bytes();
    } finally {
      if (output !== source) output.free();
    }
  } finally {
    source.free();
  }
}
