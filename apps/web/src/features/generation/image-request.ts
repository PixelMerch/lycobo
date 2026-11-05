import { apiErrorSchema } from "@lycoboai/contracts";
import { normalizeApiResponse } from "../../lib/api-response";
import { sessionFetch } from "../../lib/session-fetch";
import { rememberImageDeliveries } from "./asset-delivery-client";

export class ImageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly businessCode?: string,
  ) {
    super(message);
  }
}
export async function imageRequest(path: string, init: RequestInit = {}, timeoutMs = 30000) {
  const response = await sessionFetch(`/api/v1/${path}`, {
    ...init,
    credentials: "same-origin",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: "登录已过期，请重新登录工作台。",
      403: "当前操作没有权限。",
      400: "模型参数或参考图不受支持，请调整后重试。",
      409: "额度不足或提交参数冲突，请检查后重试。",
      413: "图片超过大小限制。",
      503: "生图服务尚未启用，请检查服务端配置。",
    };
    const failure = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ImageApiError(
      failure.success
        ? failure.data.message
        : (messages[response.status] ?? "服务暂时不可用，请稍后重试。"),
      response.status,
      failure.success ? failure.data.error.code : undefined,
    );
  }
  const normalized = await normalizeApiResponse(response);
  if (normalized.headers.get("Content-Type")?.includes("application/json"))
    rememberImageDeliveries(await normalized.clone().json());
  return normalized;
}
