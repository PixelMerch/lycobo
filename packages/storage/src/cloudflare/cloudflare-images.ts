import type { ImagesBinding } from "@cloudflare/workers-types";
import { imageLimits } from "@lycoboai/contracts";
import { z } from "zod";
import { ImageValidationError } from "../images/core";
import { displayVariants } from "../images/image-variants";
import { encodeWithoutImages } from "./cloudflare-image-fallback";

const maxBindingBytes = 20 * 1024 * 1024;
const bytesStream = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(bytes);
      controller.close();
    },
  });

function containsAnimation(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49;
  if (!png && !webp) return false;
  let offset = png ? 8 : 12;
  while (offset + 8 <= bytes.length) {
    const typeOffset = png ? offset + 4 : offset;
    const type = String.fromCharCode(...bytes.subarray(typeOffset, typeOffset + 4));
    if (["acTL", "ANIM", "ANMF"].includes(type)) return true;
    const length = view.getUint32(png ? offset : offset + 4, webp);
    offset += png ? length + 12 : length + 8 + (length % 2);
  }
  return false;
}

/** 使用 Images 处理图片，额度耗尽时在 Worker 内转换中小图片。 */
export function cloudflareImages(images: Pick<ImagesBinding, "info" | "input">) {
  async function info(bytes: Uint8Array) {
    if (!bytes.length || bytes.length > maxBindingBytes || containsAnimation(bytes))
      throw new ImageValidationError("INVALID_IMAGE");
    let metadata: Awaited<ReturnType<ImagesBinding["info"]>>;
    try {
      metadata = await images.info(bytesStream(bytes));
    } catch (error) {
      const failure = z.object({ code: z.number() }).safeParse(error);
      if (failure.success && [9412, 9520].includes(failure.data.code))
        throw new ImageValidationError("INVALID_IMAGE");
      throw new Error("IMAGE_PROCESSOR_UNAVAILABLE");
    }
    if (
      !("width" in metadata) ||
      !["image/png", "image/jpeg", "image/webp", "png", "jpeg", "webp"].includes(metadata.format)
    )
      throw new ImageValidationError("INVALID_IMAGE");
    if (
      metadata.width < 1 ||
      metadata.height < 1 ||
      metadata.width * metadata.height > 32 * 1024 * 1024
    )
      throw new ImageValidationError("INVALID_IMAGE");
    return metadata;
  }
  async function encode(
    bytes: Uint8Array,
    width?: number,
    height?: number,
    format: "image/png" | "image/webp" = "image/png",
    quality?: number,
    fit: "scale-down" | "contain" = "scale-down",
  ) {
    const target = width && height ? { width, height } : undefined;
    let output: Uint8Array;
    try {
      const handle = images.input(bytesStream(bytes));
      if (target) handle.transform({ ...target, fit, background: "transparent" });
      const result = await handle.output({ format, ...(quality ? { quality } : {}), anim: false });
      output = new Uint8Array(await result.response().arrayBuffer());
    } catch (error) {
      output = await encodeOnQuotaError(error, bytes, target, format);
    }
    if (!output.length || output.length > imageLimits.outputBytes)
      throw new ImageValidationError("INVALID_IMAGE");
    return output;
  }
  async function encodeOnQuotaError(
    error: unknown,
    bytes: Uint8Array,
    target: { width: number; height: number } | undefined,
    format: "image/png" | "image/webp",
  ) {
    // 仅对转换额度错误启用本地降级，元数据校验不消耗转换额度。
    const failure = z.object({ code: z.literal(9422) }).safeParse(error);
    if (!failure.success) throw error;
    const fallback = await encodeWithoutImages(bytes, await info(bytes), target, format);
    if (!fallback) throw error;
    return fallback;
  }
  return {
    info,
    encode,
    async reference(bytes: Uint8Array) {
      const metadata = await info(bytes);
      let edge = Math.min(3840, Math.max(metadata.width, metadata.height));
      for (let attempt = 0; attempt < 12; attempt++) {
        const encoded = await encode(bytes, edge, edge);
        if (encoded.length <= 4 * 1024 * 1024) return encoded;
        edge = Math.max(
          1,
          Math.floor(edge * Math.min(0.85, Math.sqrt((4 * 1024 * 1024) / encoded.length) * 0.95)),
        );
      }
      throw new ImageValidationError("INVALID_IMAGE");
    },
    async variant(bytes: Uint8Array, variant: "thumbnail" | "preview") {
      await info(bytes);
      const { width, height, quality } = displayVariants[variant];
      return encode(bytes, width, height, "image/webp", quality);
    },
  };
}
