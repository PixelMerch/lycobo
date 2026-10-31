import {
  apiErrorSchema,
  enterpriseIdentitySchema,
  enterpriseLoginResponseSchema,
} from "@lycoboai/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeApiResponse } from "../../lib/api-response";
import { reportRequestFailure } from "../../lib/request-diagnostics";
import { rememberSessionExpiry, resetSessionRenewal, sessionFetch } from "../../lib/session-fetch";

const authKey = ["enterprise-session"];
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
  if (envelope.success) return envelope.data.message;
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
  return "登录服务暂时不可用，请稍后重试。";
}
export function useEnterpriseSession() {
  return useQuery({
    queryKey: authKey,
    retry: false,
    staleTime: 30000,
    queryFn: async ({ signal }) => {
      const response = await authRequest("session", { signal });
      if (response.status === 401 || response.status === 503) return null;
      if (!response.ok) throw new Error("无法读取登录状态");
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
      await client.cancelQueries();
      client.setQueryData(authKey, user);
      // Reset notifies mounted observers and refetches active queries with the new cookie.
      // Removing queries leaves those observers attached to the previous login state.
      await client.resetQueries({ predicate: (query) => query.queryKey[0] !== authKey[0] });
    },
  });
}
export function useEnterpriseLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      resetSessionRenewal();
      const response = await authRequest("logout", { method: "POST" });
      if (!response.ok) throw new Error("退出失败，请稍后重试");
    },
    onSuccess: async () => {
      await client.cancelQueries();
      client.setQueryData(authKey, null);
      await client.resetQueries({ predicate: (query) => query.queryKey[0] !== authKey[0] });
    },
  });
}
