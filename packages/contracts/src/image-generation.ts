import { z } from "zod";

export const imageLimits = {
  uploadBytes: 10 * 1024 * 1024,
  outputBytes: 32 * 1024 * 1024,
  providerResponseBytes: 45 * 1024 * 1024,
} as const;

export const imageModelIds = [
  "gpt-image-2",
  "gpt-image-2-4K",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
] as const;
export const imageResolutionSchema = z.enum(["1K", "2K", "4K"]);
export type ImageResolution = z.infer<typeof imageResolutionSchema>;
export const imageGenerationInputSchema = z.strictObject({
  model: z.enum(imageModelIds),
  prompt: z.string().trim().min(1).max(9000),
  resolution: imageResolutionSchema.default("1K"),
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).default("1:1"),
  referenceAssetIds: z
    .array(z.uuid())
    .max(10)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate references"),
  count: z.number().int().min(1).max(4).default(1),
});
export type ImageGenerationInput = z.infer<typeof imageGenerationInputSchema>;
export type ImageScope = { userId: string; organizationId: string };
export type StoredImage = {
  id: string;
  objectKey: string;
  mimeType: "image/png";
  bytes: number;
  width: number;
  height: number;
  sha256: string;
};
export const imageModelCatalog = imageModelIds.map((id) => ({
  id,
  documentedResolutions: (id === "gpt-image-2"
    ? ["1K"]
    : id === "gpt-image-2-4K"
      ? ["1K", "2K", "4K"]
      : []) as ImageResolution[],
  capabilityStatus: id.includes("2.5-") ? "unverified" : "documented",
  highResolutionMode: id === "gpt-image-2-4K" ? "enhanced" : null,
}));
