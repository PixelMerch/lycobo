import { z } from "zod";
export const imageEventCursorSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n);
export const imageEventSchema = z.object({
  id: imageEventCursorSchema,
  kind: z.enum(["task", "asset"]),
  resourceId: z.uuid(),
});
export type ImageEvent = z.infer<typeof imageEventSchema>;
