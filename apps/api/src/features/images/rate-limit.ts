import { imageAutomationPath } from "@lycoboai/contracts";
import type { Context } from "hono";
import { type Env, fail, type ImageRequestRateLimits } from "./route-context";

function requestBudget(method: string, path: string): keyof ImageRequestRateLimits {
  if (method !== "POST") return "general";
  const route = path.replace(/^\/api\/v1(?=\/)/, "").replace(/\/$/, "");
  if (route === "/image-assets") return "upload";
  if (
    [
      "/image-tasks",
      "/prompt-optimizations",
      "/variation-plans",
      "/video-storyboards",
      `${imageAutomationPath}/generations`,
    ].includes(route) ||
    /^\/image-tasks\/[^/]+\/retry$/.test(route)
  )
    return "generation";
  return "general";
}

/** 在解析请求体、审核、签发素材链接前使用已验证的账号限流。 */
export async function checkImageRequestLimit(
  c: Context<Env>,
  limits: ImageRequestRateLimits,
  userId: string,
  budget = requestBudget(c.req.method, c.req.path),
) {
  try {
    if ((await limits[budget].limit({ key: userId })).success) return;
  } catch {
    // 限流服务异常时暂停入口，避免未限流的付费调用继续进入队列。
    console.error({ event: "IMAGE_RATE_LIMIT_UNAVAILABLE", budget });
    return fail(c, "IMAGE_RATE_LIMIT_UNAVAILABLE", "服务暂时不可用，请稍后重试。", 503);
  }
  c.header("Retry-After", "60");
  return fail(c, "RATE_LIMITED", "请求过于频繁，请稍后重试。", 429);
}
