import { ImageRepositoryError, VariationError, WalletError } from "@lycoboai/db";
import { type Context, Hono } from "hono";
import { enterprisePrincipal } from "../auth/principal";
import { registerImageWallet } from "../wallet/wallet-routes";
import { registerImageAssetDelivery, registerImageAssetLibrary } from "./assets/asset-routes";
import { imageDeliveries } from "./assets/delivery";
import { registerImageEvents } from "./events/event-routes";
import { registerImageModels } from "./model-routes";
import { registerImagePlanning, registerPromptOptimization } from "./planning/planning-routes";
import { type Env, fail, type ImageApiDependencies } from "./route-context";
import { setWorkbenchCookie, trustedWorkbenchRequest, workbenchPrincipal } from "./session";
import {
  registerImageTaskHistory,
  registerImageTaskReconciliation,
  registerImageTaskSubmission,
} from "./tasks/task-routes";

export type { ImageApiDependencies } from "./route-context";

function repositoryFailure(code: string): { status: 400 | 403 | 404 | 409; message: string } {
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
    case "STATE_CONFLICT":
      return { status: 409, message: "任务正在生成或状态已更新，请稍后重试" };
    default:
      return { status: 409, message: "请求未执行，请刷新后重试" };
  }
}

export function imageRoutes(deps: ImageApiDependencies) {
  const app = new Hono<Env>();
  const resolvePrincipal = async (c: Context) => {
    const bearer = c.req.header("Authorization");
    // Keep existing service API keys compatible; browser sessions never fall back to local identity.
    if (deps.auth && bearer && /^Bearer [\w-]{43}$/.test(bearer))
      return deps.repository.authenticate(bearer.slice(7));
    return deps.auth
      ? (await enterprisePrincipal(c, deps.auth))?.user
      : workbenchPrincipal(c, deps.repository, deps.session);
  };
  app.post("/image-session", async (c) => {
    if (deps.auth) {
      const principal = await resolvePrincipal(c);
      return principal
        ? c.json({ userId: principal.userId, organizationId: principal.organizationId })
        : fail(c, "UNAUTHORIZED", "请先登录", 401);
    }
    if (!deps.session || !trustedWorkbenchRequest(c, deps.session))
      return fail(c, "UNAUTHORIZED", "请先登录工作台", 401);
    const principal = await deps.repository.authenticate(deps.session.token);
    if (!principal) return fail(c, "UNAUTHORIZED", "工作台身份已过期，请重新配置", 401);
    setWorkbenchCookie(c, deps.session);
    return c.json({ userId: principal.userId, organizationId: principal.organizationId });
  });
  // Display-only metadata is public; authenticated task and capability routes stay below.
  app.get("/image-model-logos", async (c) => c.json(await deps.repository.models.logos()));
  app.use("*", async (c, next) => {
    const principal = await resolvePrincipal(c);
    if (!principal) return fail(c, "UNAUTHORIZED", "请先验证身份", 401);
    c.set("principal", principal);
    await next();
  });
  app.onError((error, c) => {
    if (error instanceof VariationError)
      return fail(
        c,
        error.code,
        "分析请求未执行，请检查图片或稍后再试",
        error.code === "RATE_LIMITED" ? 409 : 400,
      );
    if (error instanceof ImageRepositoryError || error instanceof WalletError) {
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
