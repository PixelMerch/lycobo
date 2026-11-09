import { apiErrorSchema } from "@lycoboai/contracts";
import { currentMessages } from "../../i18n/messages";
import { normalizeApiResponse } from "../../lib/api-response";
import { serverErrorMessage } from "../../lib/server-error";
import { sessionFetch } from "../../lib/session-fetch";
import { rememberImageDeliveries } from "./asset-delivery-client";
import { generationMessages } from "./generation-messages";

/** 图片接口的错误：带 HTTP 状态与服务端错误代码，提示文字按当前语言给出。 */
export class ImageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly businessCode?: string,
  ) {
    super(message);
  }
}
/** 需要先登录：未登录或登录已过期。 */
export function isSignInError(error: unknown) {
  return error instanceof ImageApiError && error.status === 401;
}

/** 调用图片接口：带会话续期与超时，失败时抛出 ImageApiError。 */
export async function imageRequest(path: string, init: RequestInit = {}, timeoutMs = 30000) {
  const response = await sessionFetch(`/api/v1/${path}`, {
    ...init,
    credentials: "same-origin",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const t = currentMessages(generationMessages);
    const messages: Record<number, string> = t.httpErrors;
    const failure = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ImageApiError(
      failure.success
        ? serverErrorMessage(failure.data)
        : (messages[response.status] ?? t.serviceUnavailable),
      response.status,
      failure.success ? failure.data.error.code : undefined,
    );
  }
  const normalized = await normalizeApiResponse(response);
  if (normalized.headers.get("Content-Type")?.includes("application/json"))
    rememberImageDeliveries(await normalized.clone().json());
  return normalized;
}
