import { z } from "zod";
export const enterpriseAccountSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9._@-]*$/);
export const enterpriseLoginSchema = z
  .object({
    account: enterpriseAccountSchema,
    password: z.string().min(1).max(256),
    captchaToken: z.string().min(1).max(2048),
  })
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
/** 可保存到账号的界面语言。 */
export const accountLocales = ["zh-CN", "en"] as const;
/** 账号界面语言的代码。 */
export type AccountLocale = (typeof accountLocales)[number];
/** 语言更新只接受站点支持的值，身份始终来自会话。 */
export const enterpriseLocaleChangeSchema = z
  .object({
    preferredLocale: z.enum(accountLocales),
  })
  .strict();

/** 首阶段接入的 Supabase OAuth 登录方式。 */
export const socialProviders = ["google", "apple"] as const;
/** OAuth 登录入口的参数。 */
export const socialLoginInputSchema = z
  .object({
    provider: z.enum(socialProviders),
    returnTo: z.string().max(900),
  })
  .strict();
/** 服务端当前启用的第三方登录方式。 */
export const socialProvidersSchema = z.object({
  providers: z.array(z.enum(socialProviders)),
  emailTurnstileSiteKey: z.string().min(1).optional(),
  passwordTurnstileSiteKey: z.string().min(1).optional(),
});
const emailAddress = z.string().trim().toLowerCase().max(254).email();
/** 验证码发送请求必须包含 Cloudflare 的短期令牌。 */
export const emailCodeSendSchema = z
  .object({
    email: emailAddress,
    captchaToken: z.string().min(1).max(2048),
  })
  .strict();
/** 验证码按字符串传输，保留前导零。 */
export const emailCodeVerifySchema = z
  .object({ email: emailAddress, code: z.string().regex(/^\d{6}$/) })
  .strict();
/** 允许浏览器导航的 HTTPS 授权地址。 */
export const socialAuthorizationSchema = z.object({ url: z.url({ protocol: /^https$/ }) });
/** OAuth 登录方式的标识。 */
export type SocialProvider = (typeof socialProviders)[number];

/** 昵称仅用于显示，支持多语言并拒绝控制字符。 */
export const userNicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[^\p{Cc}]+$/u);
/** 昵称修改仅接受新值，用户身份由会话确定。 */
export const userNicknameChangeSchema = z.object({ nickname: userNicknameSchema }).strict();

export const enterpriseIdentitySchema = z.object({
  uid: userUidSchema.optional(),
  userId: z.uuid(),
  organizationId: z.uuid(),
  role: z.enum(["admin", "member"]),
  account: z.string(),
  nickname: userNicknameSchema.nullable().optional(),
  loginMethod: z.literal("social").optional(),
  // 读取时接受任意短 id：新部署增加预设时，旧页面不会因为认不出而登录失败，只显示默认头像。
  avatarPreset: z.string().max(32).nullable().optional(),
  preferredLocale: z.string().max(32).nullable().optional(),
});
export const enterpriseLoginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  user: enterpriseIdentitySchema,
  refreshExpiresIn: z.number().int().positive().optional(),
});
export type EnterpriseIdentity = z.infer<typeof enterpriseIdentitySchema>;
