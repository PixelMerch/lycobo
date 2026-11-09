import { toast } from "@heroui/react";
import {
  apiErrorSchema,
  enterpriseIdentitySchema,
  enterpriseLoginResponseSchema,
  enterprisePasswordChangeSchema,
} from "@lycoboai/contracts";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentMessages } from "../../i18n/messages";
import { normalizeApiResponse } from "../../lib/api-response";
import { reportRequestFailure } from "../../lib/request-diagnostics";
import { serverErrorMessage } from "../../lib/server-error";
import { rememberSessionExpiry, resetSessionRenewal, sessionFetch } from "../../lib/session-fetch";
import { clearPreviewLinks } from "../generation/preview-link-cache";
import { authMessages } from "./auth-messages";

export const enterpriseSessionKey = ["enterprise-session"];
async function authRequest(path: string, init: RequestInit = {}) {
  const request = path === "session" ? sessionFetch : fetch;
  let response: Response;
  try {
    response = await request(`/api/v1/auth/${path}`, {
      ...init,
      credentials: "same-origin",
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (path !== "session" && !init.signal?.aborted)
      reportRequestFailure(`/api/v1/auth/${path}`, init.method ?? "GET");
    throw error;
  }
  if (path !== "session" && !response.ok)
    reportRequestFailure(`/api/v1/auth/${path}`, init.method ?? "GET", response);
  rememberSessionExpiry(response);
  return normalizeApiResponse(response);
}
async function errorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const envelope = apiErrorSchema.safeParse(body);
  if (envelope.success) return serverErrorMessage(envelope.data);
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = body.error;
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    )
      return error.message;
  }
  return currentMessages(authMessages).serviceUnavailable;
}
/** 读取当前登录状态；未登录或登录服务未配置时返回 null。 */
export function useEnterpriseSession() {
  return useQuery({
    queryKey: enterpriseSessionKey,
    retry: false,
    staleTime: 30000,
    queryFn: async ({ signal }) => {
      const response = await authRequest("session", { signal });
      if (response.status === 401 || response.status === 503) return null;
      if (!response.ok) throw new Error(currentMessages(authMessages).sessionUnavailable);
      return enterpriseIdentitySchema.parse(await response.json());
    },
  });
}
export function useEnterpriseLogin() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (input: { account: string; password: string }) => {
      resetSessionRenewal();
      const response = await authRequest("enterprise/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      // The browser uses the HttpOnly JWT cookie. Never put accessToken in React state/storage.
      return enterpriseLoginResponseSchema.parse(await response.json()).user;
    },
    onSuccess: async (user) => {
      clearPreviewLinks();
      await client.cancelQueries();
      client.setQueryData(enterpriseSessionKey, user);
      // Reset notifies mounted observers and refetches active queries with the new cookie.
      // Removing queries leaves those observers attached to the previous login state.
      await client.resetQueries({
        predicate: (query) => query.queryKey[0] !== enterpriseSessionKey[0],
      });
    },
  });
}
/** 退出登录，成功后清空本机的登录状态与其他缓存。 */
export function useEnterpriseLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      resetSessionRenewal();
      const response = await authRequest("logout", { method: "POST" });
      if (!response.ok) throw new Error(currentMessages(authMessages).logoutFailed);
    },
    onSuccess: async () => {
      await clearEnterpriseSession(client);
    },
  });
}

async function clearEnterpriseSession(client: QueryClient) {
  clearPreviewLinks();
  await client.cancelQueries();
  client.setQueryData(enterpriseSessionKey, null);
  await client.resetQueries({
    predicate: (query) => query.queryKey[0] !== enterpriseSessionKey[0],
  });
}

/** 修改密码：服务端会注销全部会话，这里同时清空本机的登录状态。 */
export function useEnterprisePasswordChange() {
  const client = useQueryClient();
  return useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      const validated = enterprisePasswordChangeSchema.parse(input);
      const response = await authRequest("password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
    },
    onSuccess: async () => {
      resetSessionRenewal();
      toast.success(currentMessages(authMessages).passwordChanged);
      await clearEnterpriseSession(client);
    },
  });
}
