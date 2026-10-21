import { Link as HeroLink } from "@heroui/react";
import type { ReactNode, Ref } from "react";
import {
  type NavLinkRenderProps,
  Link as RouterLink,
  NavLink as RouterNavLink,
} from "react-router";

type RouteLinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  onClick?: () => void;
  end?: boolean;
  nav?: boolean;
};

/**
 * Routes navigation through react-router while keeping HeroUI's link states.
 * Only the router's navigation primitive is reused here; no second link
 * component or press behaviour is implemented.
 */
export function RouteLink({
  to,
  children,
  className = "",
  nav = false,
  end,
  ...rest
}: RouteLinkProps) {
  return (
    <HeroLink
      href={to}
      className={className}
      {...rest}
      render={(renderProps) => {
        const { children: content, ref, style, ...props } = renderProps;
        // HeroLink renders an anchor because href is always provided.
        const linkRef = ref as Ref<HTMLAnchorElement>;
        const navProps = style ? { ...props, style } : props;
        return nav ? (
          <RouterNavLink
            {...navProps}
            className={({ isActive }: NavLinkRenderProps) =>
              isActive ? `${className} active` : className
            }
            end={end ?? false}
            ref={linkRef}
            to={to}
          >
            {content}
          </RouterNavLink>
        ) : (
          <RouterLink {...props} ref={linkRef} to={to}>
            {content}
          </RouterLink>
        );
      }}
    >
      {children}
    </HeroLink>
  );
}
