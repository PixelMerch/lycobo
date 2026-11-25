import { useLocation } from "react-router";
import { useAppNavigate } from "../../i18n/use-localized-navigation";
import { useEnterpriseSession } from "./auth-client";
import { loginHref } from "./login-navigation";

/** 所有登录入口导航到同一页面，并记录本次操作所在的地址。 */
export function useOpenLogin() {
  const location = useLocation();
  const navigate = useAppNavigate();
  return () => {
    void navigate(loginHref(`${location.pathname}${location.search}${location.hash}`));
  };
}

/** 创作交互在未登录时只跳转登录，不修改草稿或读取文件。 */
export function useRequireLogin() {
  const session = useEnterpriseSession();
  const open = useOpenLogin();
  return () => {
    if (session.data) return true;
    open();
    return false;
  };
}
