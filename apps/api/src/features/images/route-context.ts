import type { imageGenerationInputSchema } from "@lycoboai/contracts";
import type { ImageEventFeed, ImagePrincipal, ImageRuntimeRepository } from "@lycoboai/db";
import type { ImageStore } from "@lycoboai/storage/core";
import type { Context } from "hono";
import { z } from "zod";
import type { EnterpriseAuth } from "../auth/service";
import type { CheckoutService } from "../billing/service";
import type { ExternalWalletService } from "../billing/wallet-service";
import type { GenerationModerator } from "../moderation/service";
import type { DeliverySigner } from "./assets/delivery";
import type { WorkbenchSession } from "./session";

type Limiter = { limit(input: { key: string }): Promise<{ success: boolean }> };

/** 三类账号预算由运行环境提供，图片接口只依赖计数结果。 */
export type ImageRequestRateLimits = {
  generation: Limiter;
  upload: Limiter;
  general: Limiter;
};

export type ImageApiDependencies = {
  repository: ImageRuntimeRepository;
  rateLimits?: ImageRequestRateLimits | undefined;
  moderate?: GenerationModerator | undefined;
  billing?: ExternalWalletService | undefined;
  checkout?: CheckoutService | undefined;
  wakeBilling?: ((jobId: string) => Promise<void>) | undefined;
  billingWebhooks?: import("hono").Hono | undefined;
  uploadsEnabled?: boolean;
  uploads?: {
    enqueue(scope: ImagePrincipal, bytes: Uint8Array): Promise<string>;
    status(
      scope: ImagePrincipal,
      id: string,
    ): Promise<{ status: string; image?: import("@lycoboai/contracts").StoredImage } | null>;
  };
  modelSecret?: string | undefined;
  plannerKey?: string | undefined;
  plannerRequest?: typeof fetch | undefined;
  standaloneKey?: string | undefined;
  providerRequest?: typeof fetch | undefined;
  events?: ImageEventFeed | undefined;
  // 没有推送传输时，在入队后唤醒后台处理。
  wake?: (() => Promise<void>) | undefined;
  signAsset?: DeliverySigner | undefined;
  auth?: Pick<EnterpriseAuth, "authenticate" | "config"> | undefined;
  store: ImageStore;
  enabled: boolean;
  managedModelsOnly?: boolean;
  unitCredits: number;
  editsEnabled?: boolean;
  session?: WorkbenchSession | undefined;
  // API 和 Worker 共用能力策略，由启动入口注入。
  validate: (input: z.infer<typeof imageGenerationInputSchema>) => void;
  resolutions: (model: z.infer<typeof imageGenerationInputSchema>["model"]) => string[];
};
export type Env = {
  Variables: {
    principal: ImagePrincipal;
    authenticatedSession?: boolean;
    enterpriseSession?: boolean;
    requestId: string;
  };
};
export const id = z.uuid();
/** 返回图片 API 的业务错误，并保留请求编号和 HTTP 状态。 */
export const fail = (
  c: Context<Env>,
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503,
) => c.json({ error: { code, message, requestId: c.get("requestId") } }, status);
