import type { ImagesBinding } from "@cloudflare/workers-types";
import { imageLimits } from "@lycoboai/contracts";

export const displayVariants = {
  thumbnail: { width: 512, height: 512, quality: 76 },
  preview: { width: 1600, height: 1600, quality: 82 },
} as const;
export type DisplayVariant = keyof typeof displayVariants;
export const displayObjectKey = (key: string, variant: DisplayVariant) =>
  key.replace(/\.png$/, `.${variant}.webp`);

export async function displayImage(
  images: Pick<ImagesBinding, "input">,
  source: ReadableStream<Uint8Array>,
  variant: DisplayVariant,
) {
  const { width, height, quality } = displayVariants[variant];
  const result = await images
    .input(source)
    .transform({ width, height, fit: "scale-down" })
    .output({ format: "image/webp", quality, anim: false });
  const response = result.response();
  if (!response.ok) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > imageLimits.outputBytes)
    throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
  return bytes;
}
