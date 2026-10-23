import { Dropdown } from "@heroui/react";
import { IconChevronRight, type TablerIcon } from "@tabler/icons-react";
import { type ReactNode, useId, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { RouteLink } from "./router-link";
import { UiIcon } from "./ui-icon";
import { useHoverMenu } from "./use-hover-menu";
import "./feature-navigation.css";

/** Complete sidebar destination with delayed hover browsing and touch/keyboard access. */
export function FeatureNavigation({
  label,
  href,
  icon,
  triggerLabel,
  heading,
  collapsed,
  mobile,
  onNavigate,
  onSelect,
  children,
  className = "",
  menuClassName = "",
}: {
  label: string;
  href: string;
  icon: TablerIcon;
  triggerLabel: string;
  heading: string;
  collapsed: boolean;
  mobile: boolean;
  onNavigate: () => void;
  onSelect: (key: string | number) => void;
  children: ReactNode;
  className?: string;
  menuClassName?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const pressWasOpen = useRef<boolean | null>(null);
  const menu = useHoverMenu(trigger, `[data-feature-menu="${id}"] [role='menuitem']`, {
    openDelay: 250,
    closeDelay: 200,
    keepOpenOnHoveredPress: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === href || location.pathname.startsWith(`${href}/`);
  function enterPage() {
    menu.close();
    onNavigate();
    navigate(href);
  }
  return (
    <div
      className={`feature-nav-row ${className}`}
      data-active={active || undefined}
      data-collapsed={collapsed || undefined}
      onPointerEnter={menu.triggerProps.onPointerEnter}
      onPointerLeave={menu.triggerProps.onPointerLeave}
    >
      {!collapsed && (
        <RouteLink
          nav
          to={href}
          aria-label={label}
          className="nav-row feature-nav-link"
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              trigger.current?.focus();
              menu.openFromKeyboard();
            }
          }}
          onClick={() => {
            menu.close();
            onNavigate();
          }}
        >
          <UiIcon icon={icon} size="default" />
          <span className="nav-label">{label}</span>
        </RouteLink>
      )}
      <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
        <Dropdown.Trigger
          ref={trigger}
          className={collapsed ? "nav-row feature-icon-trigger" : "feature-tool-trigger"}
          aria-label={collapsed ? label : triggerLabel}
          aria-current={collapsed && active ? "page" : false}
          {...(collapsed
            ? { "aria-description": `点击进入${label}，悬停或按向下方向键${triggerLabel}` }
            : {})}
          onPress={() => {
            if (collapsed) enterPage();
            else if (pressWasOpen.current ?? menu.isOpen) menu.close();
            else menu.onOpenChange(true);
            pressWasOpen.current = null;
          }}
          onPointerDown={() => {
            // Remember the state before React Aria's press/outside handlers run.
            pressWasOpen.current = menu.isOpen;
            menu.triggerProps.onPointerDown();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") pressWasOpen.current = menu.isOpen;
            if (collapsed && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              enterPage();
              return;
            }
            menu.triggerProps.onKeyDown(event);
          }}
        >
          {collapsed ? (
            <>
              <UiIcon icon={icon} size="default" />
              <span className="nav-label">{label}</span>
            </>
          ) : (
            <UiIcon icon={IconChevronRight} size="small" />
          )}
        </Dropdown.Trigger>
        <Dropdown.Popover
          className={`feature-tool-menu ${menuClassName}`}
          data-feature-menu={id}
          placement={mobile ? "bottom end" : "right top"}
          offset={12}
          isNonModal
          {...menu.popoverProps}
        >
          <div className="feature-tool-heading">{heading}</div>
          <Dropdown.Menu
            autoFocus={false}
            onAction={(key) => {
              menu.close();
              onNavigate();
              onSelect(key);
            }}
          >
            {children}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
