import { Button, Disclosure, Dropdown } from "@heroui/react";
import { IconChevronDown } from "@tabler/icons-react";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { inspirationLibraryPath } from "../features/inspiration/inspiration-path";
import {
  type WorkspaceToolCategory,
  workspaceToolCategories,
} from "../features/workspace/workspace-tool-categories";
import { workspaceToolMessages } from "../features/workspace/workspace-tool-messages";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { useMessages } from "../i18n/messages";
import { useAppNavigate } from "../i18n/use-localized-navigation";
import { dashboardToolPaths, freeCanvasPath } from "../lib/dashboard-paths";
import { useHoverMenu } from "../lib/use-hover-menu";
import { shellMessages } from "./shell-messages";

/** 公共顶栏显示工具目录；首页额外提供桌面与手机共用的 FAQ 定位入口。 */
export function PublicSiteNavigation({
  onNavigate,
  dismissVersion = 0,
  onFaq,
}: {
  onNavigate?: () => void;
  dismissVersion?: number;
  onFaq?: (() => void) | undefined;
}) {
  const t = useMessages(shellMessages);
  const linkEvents = onNavigate ? { onClick: onNavigate } : {};
  return (
    <nav
      className={onNavigate ? "public-site-mobile-nav" : "topbar-nav public-site-desktop-nav"}
      aria-label={t.mainNavigation}
    >
      {workspaceToolCategories.map((category) =>
        onNavigate ? (
          <PublicMobileCategory key={category.label} category={category} onNavigate={onNavigate} />
        ) : (
          <PublicCategoryMenu
            key={category.label}
            category={category}
            dismissVersion={dismissVersion}
          />
        ),
      )}
      <RouteLink nav end to={inspirationLibraryPath} className="nav-row" {...linkEvents}>
        {t.inspiration}
      </RouteLink>
      <RouteLink nav to={freeCanvasPath} className="nav-row" {...linkEvents}>
        {t.freeCanvas}
      </RouteLink>
      {onFaq && (
        <Button
          variant="ghost"
          className="nav-row public-site-faq"
          onPress={() => {
            onNavigate?.();
            onFaq();
          }}
        >
          {t.faq}
        </Button>
      )}
    </nav>
  );
}

function PublicCategoryMenu({
  category,
  dismissVersion,
}: {
  category: WorkspaceToolCategory;
  dismissVersion: number;
}) {
  const { navigation } = useMessages(workspaceToolMessages);
  const menu = useHoverMenu(100, dismissVersion);
  const navigate = useAppNavigate();
  const entries = category.sections.flatMap((section) => section.entries);
  return (
    <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
      <Dropdown.Trigger
        ref={menu.triggerRef}
        className="nav-row topbar-menu-trigger"
        onHoverStart={(event) => {
          if (event.pointerType === "mouse") menu.openOnHover();
        }}
        onHoverEnd={menu.closeSoon}
      >
        {navigation[category.label]}
        <UiIcon icon={IconChevronDown} size="small" className="topbar-menu-chevron" />
      </Dropdown.Trigger>
      <Dropdown.Popover
        ref={menu.popoverRef}
        className="topbar-menu header-menu landing-control-popover"
        placement="bottom start"
        offset={4}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label={navigation[category.label]}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
          onAction={(key) => {
            const entry = entries.find(({ tool }) => tool === key);
            if (!entry) return;
            menu.close();
            void navigate(dashboardToolPaths[entry.tool]);
          }}
        >
          {entries.map(({ tool }) => (
            <Dropdown.Item
              key={tool}
              id={tool}
              textValue={navigation.tools[tool]}
              className="topbar-menu-item menu-item"
            >
              <UiIcon icon={toolIcons[tool]} size="small" />
              {navigation.tools[tool]}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function PublicMobileCategory({
  category,
  onNavigate,
}: {
  category: WorkspaceToolCategory;
  onNavigate: () => void;
}) {
  const { navigation } = useMessages(workspaceToolMessages);
  return (
    <Disclosure>
      <Disclosure.Heading>
        <Disclosure.Trigger className="nav-row">
          {navigation[category.label]}
          <Disclosure.Indicator>
            <UiIcon icon={IconChevronDown} size="small" />
          </Disclosure.Indicator>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          {category.sections.map(({ heading, entries }) => (
            <section key={heading}>
              <h2 className="nav-group-label">{navigation[heading]}</h2>
              {entries.map(({ tool }) => (
                <RouteLink
                  key={tool}
                  to={dashboardToolPaths[tool]}
                  className="nav-row"
                  onClick={onNavigate}
                >
                  <UiIcon icon={toolIcons[tool]} size="small" />
                  {navigation.tools[tool]}
                </RouteLink>
              ))}
            </section>
          ))}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
