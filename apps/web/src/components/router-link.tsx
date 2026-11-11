import { Link as HeroLink } from "@heroui/react";
import type { KeyboardEventHandler, ReactNode } from "react";
import {
  type NavLinkRenderProps,
  Link as RouterLink,
  NavLink as RouterNavLink,
} from "react-router";
import { localizedPath } from "../i18n/locale-path";
import { useLocale } from "../i18n/locale-store";

type RouteLinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  onClick?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
  end?: boolean;
  nav?: boolean;
};

/** 站内链接沿用 HeroUI 交互，并统一携带当前语言前缀。 */
export function RouteLink({
  to,
  children,
  className = "",
  nav = false,
  end,
  ...rest
}: RouteLinkProps) {
  const localizedTo = localizedPath(to, useLocale());
  return (
    <HeroLink
      href={localizedTo}
      className={className}
      {...rest}
      render={(renderProps) => {
        const { children: content, ref, style, ...props } = renderProps;
        const linkRef = (node: HTMLAnchorElement | null) => {
          if (typeof ref === "function") return ref(node);
          if (ref) ref.current = node;
        };
        const navProps = style ? { ...props, style } : props;
        return nav ? (
          <RouterNavLink
            {...navProps}
            className={({ isActive }: NavLinkRenderProps) =>
              isActive ? `${className} active` : className
            }
            end={end ?? false}
            ref={linkRef}
            to={localizedTo}
          >
            {content}
          </RouterNavLink>
        ) : (
          <RouterLink {...props} ref={linkRef} to={localizedTo}>
            {content}
          </RouterLink>
        );
      }}
    >
      {children}
    </HeroLink>
  );
}
