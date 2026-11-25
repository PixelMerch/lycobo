import {
  type SocialProvider,
  socialAuthorizationSchema,
  socialLoginInputSchema,
  socialProvidersSchema,
} from "@lycoboai/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { currentMessages } from "../../i18n/messages";
import { normalizeApiResponse } from "../../lib/api-response";
import { authMessages } from "./auth-messages";

/** 读取服务端已启用的登录方式与公开站点密钥。 */
export function useLoginAvailability() {
  return useQuery({
    queryKey: ["social-login-providers"],
    retry: false,
    staleTime: 60000,
    queryFn: async ({ signal }) => {
      const response = await normalizeApiResponse(
        await fetch("/api/v1/auth/oauth/providers", { signal }),
      );
      if (!response.ok) return socialProvidersSchema.parse({ providers: [] });
      return socialProvidersSchema.parse(await response.json());
    },
  });
}

/** 展示已启用的登录方式，并在用户主动点击后开始第三方授权。 */
export function useSocialLogin(returnTo: string) {
  const availability = useLoginAvailability();
  const start = useMutation({
    mutationFn: async (provider: SocialProvider) => {
      const target =
        returnTo.length <= 900
          ? returnTo
          : returnTo.slice(0, returnTo.startsWith("/zh-CN") ? 6 : 3);
      const body = socialLoginInputSchema.parse({ provider, returnTo: target });
      const response = await normalizeApiResponse(
        await fetch("/api/v1/auth/oauth/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        }),
      );
      if (!response.ok) throw new Error(currentMessages(authMessages).socialFailed);
      const { url } = socialAuthorizationSchema.parse(await response.json());
      window.location.assign(url);
    },
  });
  // 从第三方授权页按“返回”回来时，页面可能直接从浏览器缓存恢复，清掉跳转状态，按钮不再一直转圈。
  const { reset } = start;
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [reset]);
  return {
    providers: availability.data?.providers ?? [],
    emailSiteKey: availability.data?.emailTurnstileSiteKey,
    start,
    // 从请求授权地址到页面离开都算“正在跳转”，被点的那个按钮一直转圈。
    redirecting: start.isPending || start.isSuccess ? start.variables : undefined,
  };
}
