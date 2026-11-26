import { BillingError } from "@lycoboai/billing";
import { defaultCreditOfferEnd } from "@lycoboai/contracts";
import { ImageRepositoryError, VariationError, WalletError } from "@lycoboai/db";
import { type Context, Hono } from "hono";
import { enterprisePrincipal } from "../auth/principal";
import { ModerationError } from "../moderation/service";
import { registerImageWallet } from "../wallet/wallet-routes";
import { registerImageAssetDelivery, registerImageAssetLibrary } from "./assets/asset-routes";
import { imageDeliveries } from "./assets/delivery";
import { registerImageEvents } from "./events/event-routes";
import { registerImageModels } from "./model-routes";
import { registerImagePlanning, registerPromptOptimization } from "./planning/planning-routes";
import { checkImageRequestLimit } from "./rate-limit";
import { type Env, fail, type ImageApiDependencies } from "./route-context";
import { setWorkbenchCookie, trustedWorkbenchRequest, workbenchPrincipal } from "./session";
import {
  registerImageTaskHistory,
  registerImageTaskReconciliation,
  registerImageTaskSubmission,
} from "./tasks/task-routes";

export type { ImageApiDependencies } from "./route-context";

function repositoryFailure(code: string): { status: 400 | 403 | 404 | 409 | 503; message: string } {
  switch (code) {
    case "FORBIDDEN":
      return { status: 403, message: "没有权限操作此任务" };
    case "NOT_FOUND":
      return { status: 404, message: "任务不存在或已不可用" };
    case "REFERENCE_NOT_FOUND":
      return { status: 400, message: "请求未执行，请刷新后重试" };
    case "MODEL_CAPABILITY_UNVERIFIED":
      return { status: 400, message: "当前模型渠道未启用或不支持所选参数，请刷新模型配置" };
    case "INSUFFICIENT_CREDITS":
      return { status: 409, message: "积分不足，请充值后重试" };
    case "BILLING_UNAVAILABLE":
    case "CREDIT_APPROVAL_INVALID":
      return { status: 503, message: "积分结算暂不可用，请稍后重试" };
    case "STATE_CONFLICT":
      return { status: 409, message: "任务正在生成或状态已更新，请稍后重试" };
    default:
      return { status: 409, message: "请求未执行，请刷新后重试" };
  }
}

/** 注册鉴权后的图片接口，并将业务失败转换为统一响应。 */
export function imageRoutes(deps: ImageApiDependencies) {
  const app = new Hono<Env>();
  const resolvePrincipal = async (c: Context<Env>) => {
    const bearer = c.req.header("Authorization");
    // 保留服务 API 密钥的兼容性，浏览器会话不回退到本地身份。
    if (deps.auth && bearer && /^Bearer [\w-]{43}$/.test(bearer))
      return deps.repository.authenticate(bearer.slice(7));
    if (!deps.auth) return workbenchPrincipal(c, deps.repository, deps.session);
    const identity = await enterprisePrincipal(c, deps.auth);
    // 充值需要已校验的登录会话，API 密钥和本地工作台身份不具备付款权限。
    if (identity) c.set("authenticatedSession", true);
    return identity?.user;
  };
  app.post("/image-session", async (c) => {
    if (deps.auth) {
      const principal = await resolvePrincipal(c);
      if (!principal) return fail(c, "UNAUTHORIZED", "请先登录", 401);
      const limited =
        deps.rateLimits && (await checkImageRequestLimit(c, deps.rateLimits, principal.userId));
      return (
        limited ?? c.json({ userId: principal.userId, organizationId: principal.organizationId })
      );
    }
    if (!deps.session || !trustedWorkbenchRequest(c, deps.session))
      return fail(c, "UNAUTHORIZED", "请先登录工作台", 401);
    const principal = await deps.repository.authenticate(deps.session.token);
    if (!principal) return fail(c, "UNAUTHORIZED", "工作台身份已过期，请重新配置", 401);
    setWorkbenchCookie(c, deps.session);
    return c.json({ userId: principal.userId, organizationId: principal.organizationId });
  });
  // 展示用元数据公开，任务和能力接口仍需鉴权。
  app.get("/image-model-logos", async (c) => c.json(await deps.repository.models.logos()));
  app.get("/credit-pricing", (c) =>
    c.json({ offerEnd: deps.checkout?.offerEnd ?? defaultCreditOfferEnd }),
  );
  app.use("*", async (c, next) => {
    const principal = await resolvePrincipal(c);
    if (!principal) return fail(c, "UNAUTHORIZED", "请先验证身份", 401);
    if (deps.rateLimits) {
      const limited = await checkImageRequestLimit(c, deps.rateLimits, principal.userId);
      if (limited) return limited;
    }
    c.set("principal", principal);
    await next();
  });
  app.onError((error, c) => {
    if (error instanceof ModerationError)
      return fail(c, error.code, error.failure.message, error.failure.status);
    if (error instanceof VariationError)
      return fail(
        c,
        error.code,
        "分析请求未执行，请检查图片或稍后再试",
        error.code === "RATE_LIMITED" ? 409 : 400,
      );
    if (
      error instanceof ImageRepositoryError ||
      error instanceof WalletError ||
      error instanceof BillingError
    ) {
      const { status, message } = repositoryFailure(error.code);
      return fail(c, error.code, message, status);
    }
    if (error instanceof SyntaxError) return fail(c, "VALIDATION_ERROR", "请求格式不正确", 400);
    throw error;
  });
  registerImageEvents(app, deps, resolvePrincipal);
  registerImageModels(app, deps);
  registerPromptOptimization(app, deps);
  registerImagePlanning(app, deps);
  registerImageWallet(app, deps);
  registerImageTaskSubmission(app, deps);
  const delivery = deps.signAsset ? imageDeliveries(deps.repository, deps.signAsset) : undefined;
  registerImageTaskHistory(app, deps, delivery);
  registerImageAssetLibrary(app, deps, delivery);
  registerImageAssetDelivery(app, deps, delivery);
  registerImageTaskReconciliation(app, deps);
  return app;
}
