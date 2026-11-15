import type { ImagesBinding } from "@cloudflare/workers-types";
import { imageLimits } from "@lycoboai/contracts";
import { z } from "zod";
import { ImageValidationError } from "../images/core";
import { displayVariants } from "../images/image-variants";

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

/** Images handles decoding; application limits and animation rejection stay explicit. */
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
    const handle = images.input(bytesStream(bytes));
    if (width && height) handle.transform({ width, height, fit, background: "transparent" });
    const result = await handle.output({ format, ...(quality ? { quality } : {}), anim: false });
    const output = new Uint8Array(await result.response().arrayBuffer());
    if (!output.length || output.length > imageLimits.outputBytes)
      throw new ImageValidationError("INVALID_IMAGE");
    return output;
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
