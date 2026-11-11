import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import type { Locale } from "../../i18n/locale";
import { localizedPath } from "../../i18n/locale-path";
import { rememberLocale } from "../../i18n/locale-store";
import { useErrorToast } from "../../lib/error-toast";
import { enterpriseSessionKey, useEnterpriseLocale } from "./auth-client";

/** 顶栏和账户设置共用语言切换；登录后先保存偏好，再切换当前页面。 */
export function useAccountLanguage(account?: EnterpriseIdentity) {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { mutation, isSaving } = useEnterpriseLocale(account?.userId);
  useErrorToast(mutation.error?.message);

  function changeLanguage(next: Locale) {
    if (isSaving) return;
    const path = `${location.pathname}${location.search}${location.hash}`;
    const address = window.location.href;
    const switchLanguage = () => {
      // 保存期间如果用户已离开原页面，只保留偏好，避免把用户跳回去。
      if (window.location.href !== address) return;
      const target = localizedPath(path, next);
      rememberLocale(next);
      if (target === path) return;
      void navigate(target, { state: location.state, preventScrollReset: true });
    };
    if (!account || account.preferredLocale === next) {
      switchLanguage();
      return;
    }
    mutation.mutate(next, {
      onSuccess: (user) => {
        const active = client.getQueryData<EnterpriseIdentity>(enterpriseSessionKey);
        if (active?.userId === user.userId) switchLanguage();
      },
    });
  }
  return { changeLanguage, isSaving };
}
