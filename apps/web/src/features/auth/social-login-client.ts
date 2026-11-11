import {
  type SocialProvider,
  socialAuthorizationSchema,
  socialLoginInputSchema,
  socialProvidersSchema,
} from "@lycoboai/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { currentMessages } from "../../i18n/messages";
import { normalizeApiResponse } from "../../lib/api-response";
import { authMessages } from "./auth-messages";

/** 获取服务端启用的登录方式，并在用户主动点击后开始授权。 */
export function useSocialLogin(returnTo: string) {
  const availability = useQuery({
    queryKey: ["social-login-providers"],
    retry: false,
    staleTime: 60000,
    queryFn: async ({ signal }) => {
      const response = await normalizeApiResponse(
        await fetch("/api/v1/auth/oauth/providers", { signal }),
      );
      if (!response.ok) return { providers: [] };
      return socialProvidersSchema.parse(await response.json());
    },
  });
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
  return {
    providers: availability.data?.providers ?? [],
    emailSiteKey: availability.data?.emailTurnstileSiteKey,
    start,
  };
}
