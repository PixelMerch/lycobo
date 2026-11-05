import { Link as HeroLink } from "@heroui/react";
import type { KeyboardEventHandler, ReactNode } from "react";
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
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
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
