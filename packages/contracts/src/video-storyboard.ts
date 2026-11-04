import { z } from "zod";
import {
  storyboardOriginalImageLimit,
  videoInputSchema,
  videoReferenceLimit,
} from "./video-generation";

export const storyboardImageLimit = videoReferenceLimit;
export const storyboardVideoShotLimit = storyboardImageLimit - 1;
export const storyboardCountSchema = z.number().int().min(1).max(storyboardImageLimit);
const originalImagesShape = {
  originalAssetId: z.uuid(),
  additionalOriginalAssetIds: z
    .array(z.uuid())
    .max(storyboardOriginalImageLimit - 1)
    .optional(),
};
export const storyboardOriginals = ({
  originalAssetId,
  additionalOriginalAssetIds,
}: {
  originalAssetId: string;
  additionalOriginalAssetIds?: string[] | undefined;
}) => [originalAssetId, ...(additionalOriginalAssetIds ?? [])];
export const storyboardRequestSchema = z.discriminatedUnion("stage", [
  z
    .strictObject({
      stage: z.literal("plan"),
      description: videoInputSchema.shape.prompt,
      seconds: videoInputSchema.shape.seconds,
      ...originalImagesShape,
      count: storyboardCountSchema,
    })
    .refine((input) => {
      const ids = storyboardOriginals(input);
      return new Set(ids).size === ids.length;
    }),
  z
    .strictObject({
      stage: z.literal("video"),
      description: videoInputSchema.shape.prompt,
      seconds: videoInputSchema.shape.seconds,
      ...originalImagesShape,
      shots: z
        .array(
          z.strictObject({
            assetId: z.uuid(),
            title: z.string().trim().min(1).max(40),
            prompt: z.string().trim().min(1).max(250),
          }),
        )
        .min(1)
        .max(storyboardVideoShotLimit),
    })
    .refine((input) => {
      const ids = [...storyboardOriginals(input), ...input.shots.map((shot) => shot.assetId)];
      return ids.length <= storyboardImageLimit && new Set(ids).size === ids.length;
    }),
]);
export type StoryboardRequest = z.infer<typeof storyboardRequestSchema>;
export const storyboardCapabilitiesSchema = z.object({
  enabled: z.boolean(),
  maxStoryboardOriginalImages: z.number().int().min(1).max(storyboardOriginalImageLimit).optional(),
});

const requestSchema = z.object({ key: z.uuid(), input: storyboardRequestSchema });
const storyboardProgressSchema = z.object({
  planId: z.uuid().optional(),
  planAttempt: requestSchema.optional(),
  batchId: z.uuid().optional(),
  imageTarget: z.union([z.literal("batch"), z.uuid()]).optional(),
  acceptedVideoId: z.uuid().optional(),
  optimization: requestSchema.extend({ prompt: z.string().optional() }).optional(),
});
export type StoryboardProgress = z.infer<typeof storyboardProgressSchema>;
export const storedStoryboardSchema = z.object({
  description: z.string().max(5000),
  count: z.number().int().min(1).max(9),
  seconds: z.number().int().min(5).max(30),
  ...originalImagesShape,
  originalAssetId: z.uuid().optional(),
  progress: storyboardProgressSchema,
});
