import { useCallback } from "react";
import { type NavigateOptions, useLocation, useNavigate } from "react-router";
import { localizedPath, withoutLocale } from "./locale-path";
import { currentLocale } from "./locale-store";

/** 返回业务路径供功能判断，同时保留完整路径供登录返回使用。 */
export function useAppLocation() {
  const location = useLocation();
  return {
    ...location,
    pathname: withoutLocale(location.pathname),
    pathnameWithLocale: location.pathname,
  };
}

/** 点击时读取当前语言，语言切换不重建任务通知的导航回调。 */
export function useAppNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: string, options?: NavigateOptions) =>
      navigate(localizedPath(to, currentLocale()), options),
    [navigate],
  );
}
