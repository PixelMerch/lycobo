import { enterpriseIdentitySchema, enterpriseLoginResponseSchema } from "@lycoboai/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const authKey = ["enterprise-session"];
async function authRequest(path: string, init: RequestInit = {}) {
  return fetch(`/api/v1/auth/${path}`, {
    ...init,
    credentials: "same-origin",
    signal: init.signal ?? AbortSignal.timeout(15000),
  });
}
async function errorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null);
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
    refetchInterval: 60000,
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
      client.removeQueries();
      client.setQueryData(authKey, user);
    },
  });
}
export function useEnterpriseLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await authRequest("logout", { method: "POST" });
      if (!response.ok) throw new Error("退出失败，请稍后重试");
    },
    onSuccess: async () => {
      await client.cancelQueries();
      client.removeQueries();
      client.setQueryData(authKey, null);
    },
  });
}
