import { z } from "zod";

export const textileViews = [
  { id: "overhead-wide", name: "俯拍全景" },
  { id: "overhead-close", name: "俯拍近景" },
  { id: "close-up", name: "近距离特写" },
  { id: "pillow", name: "枕头特写" },
  { id: "bed-end", name: "床尾特写" },
  { id: "angled-overhead", name: "45度角俯拍" },
  { id: "front", name: "正面" },
  { id: "angled-level", name: "45度角平拍" },
  { id: "draped", name: "被子拖地" },
  { id: "fabric", name: "面料特写" },
] as const;
export const textileViewIdSchema = z.enum(textileViews.map((view) => view.id));
export type TextileViewId = z.infer<typeof textileViewIdSchema>;
export const textileGenerationSchema = z.strictObject({
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  views: z
    .array(textileViewIdSchema)
    .min(1)
    .max(10)
    .refine((views) => new Set(views).size === views.length, "Duplicate textile views"),
});
export type TextileGeneration = z.infer<typeof textileGenerationSchema>;
