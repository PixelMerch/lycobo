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
export const enterprisePasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256),
  })
  .strict();
export const userUidSchema = z.string().regex(/^[0-9]{10}$/);
/** 账户可选的预设头像；服务端只接受这些 id，配色由前端决定。 */
export const avatarPresetIds = [
  "lime",
  "mint",
  "peach",
  "sky",
  "sunset",
  "rose",
  "teal",
  "citrus",
  "ocean",
  "forest",
  "sand",
  "graphite",
] as const;
/** 预设头像 id。 */
export type AvatarPreset = (typeof avatarPresetIds)[number];
/** 修改头像只能选预设，传 null 恢复默认头像。 */
export const enterpriseAvatarChangeSchema = z
  .object({ avatarPreset: z.enum(avatarPresetIds).nullable() })
  .strict();
export const enterpriseIdentitySchema = z.object({
  uid: userUidSchema.optional(),
  userId: z.uuid(),
  organizationId: z.uuid(),
  role: z.enum(["admin", "member"]),
  account: z.string(),
  // 读取时接受任意短 id：新部署增加预设时，旧页面不会因为认不出而登录失败，只显示默认头像。
  avatarPreset: z.string().max(32).nullable().optional(),
});
export const enterpriseLoginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  user: enterpriseIdentitySchema,
  refreshExpiresIn: z.number().int().positive().optional(),
});
export type EnterpriseIdentity = z.infer<typeof enterpriseIdentitySchema>;
