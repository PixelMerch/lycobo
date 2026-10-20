import { z } from "zod";
export const enterpriseAccountSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._@-]*$/);
export const enterpriseLoginSchema = z
  .object({ account: enterpriseAccountSchema, password: z.string().min(1).max(256) })
  .strict();
export const userUidSchema = z.string().regex(/^[0-9]{10}$/);
export const enterpriseIdentitySchema = z.object({
  uid: userUidSchema.optional(),
  userId: z.uuid(),
  organizationId: z.uuid(),
  role: z.enum(["admin", "member"]),
  account: z.string(),
});
export const enterpriseLoginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  user: enterpriseIdentitySchema,
});
export type EnterpriseIdentity = z.infer<typeof enterpriseIdentitySchema>;
