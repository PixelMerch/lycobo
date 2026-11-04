import { z } from "zod";
import { videoInputSchema } from "./video-generation";

export const storyboardImageLimit = 9;
export const storyboardVideoShotLimit = storyboardImageLimit - 1;
export const storyboardCountSchema = z.number().int().min(1).max(storyboardImageLimit);
export const storyboardRequestSchema = z.discriminatedUnion("stage", [
  z.strictObject({
    stage: z.literal("plan"),
    description: videoInputSchema.shape.prompt,
    seconds: videoInputSchema.shape.seconds,
    originalAssetId: z.uuid(),
    count: storyboardCountSchema,
  }),
  z
    .strictObject({
      stage: z.literal("video"),
      description: videoInputSchema.shape.prompt,
      seconds: videoInputSchema.shape.seconds,
      originalAssetId: z.uuid(),
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
    .refine(
      ({ shots, originalAssetId }) =>
        new Set([originalAssetId, ...shots.map((shot) => shot.assetId)]).size === shots.length + 1,
    ),
]);
export type StoryboardRequest = z.infer<typeof storyboardRequestSchema>;

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
  originalAssetId: z.uuid().optional(),
  progress: storyboardProgressSchema,
});
