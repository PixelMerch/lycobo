import { IconArrowUpRight } from "@tabler/icons-react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";

/** 首页各区块共用本地化操作链接、箭头与主次样式。 */
export function LandingActionLink({
  to,
  variant = "primary",
  showArrow = true,
  children,
}: {
  to: string;
  variant?: "primary" | "secondary";
  showArrow?: boolean;
  children: string;
}) {
  return (
    <RouteLink to={to} className={`lp-btn-${variant}`}>
      {children}
      {showArrow ? <UiIcon icon={IconArrowUpRight} size="small" /> : null}
    </RouteLink>
  );
}
