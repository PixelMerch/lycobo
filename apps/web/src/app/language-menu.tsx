import { Dropdown, type Selection } from "@heroui/react";
import { IconChevronDown, IconWorld } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { UiIcon } from "../components/ui-icon";
import { localeNames, localeShortNames, locales, parseLocale } from "../i18n/locale";
import { localizedPath } from "../i18n/locale-path";
import { useLocaleStore } from "../i18n/locale-store";
import { useMessages } from "../i18n/messages";
import { useHoverMenu } from "../lib/use-hover-menu";
import { shellMessages } from "./shell-messages";
import "./language-menu.css";

/** 切换当前页面的语言路径，保留参数、历史状态与滚动位置。 */
export function LanguageMenu() {
  const locale = useLocaleStore((state) => state.locale);
  const location = useLocation();
  const navigate = useNavigate();
  const t = useMessages(shellMessages);
  const menu = useHoverMenu();
  function select(keys: Selection) {
    menu.close();
    if (keys === "all") return;
    const next = parseLocale(Array.from(keys)[0]);
    if (!next || next === locale) return;
    void navigate(localizedPath(`${location.pathname}${location.search}${location.hash}`, next), {
      state: location.state,
      preventScrollReset: true,
    });
  }
  return (
    <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
      <Dropdown.Trigger
        ref={menu.triggerRef}
        className="language-trigger"
        aria-label={t.language(localeNames[locale])}
        onHoverStart={(event) => {
          if (event.pointerType === "mouse") menu.openOnHover();
        }}
        onHoverEnd={menu.closeSoon}
      >
        <UiIcon icon={IconWorld} size="navigation" />
        <span className="language-trigger-name">{localeShortNames[locale]}</span>
        <UiIcon icon={IconChevronDown} size="small" className="language-trigger-chevron" />
      </Dropdown.Trigger>
      <Dropdown.Popover
        ref={menu.popoverRef}
        className="language-menu header-menu"
        placement="bottom end"
        offset={4}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label={t.chooseLanguage}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[locale]}
          onSelectionChange={select}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
        >
          {locales.map((code) => (
            <Dropdown.Item
              key={code}
              id={code}
              textValue={localeNames[code]}
              className="language-menu-item"
            >
              {/* 语言名用各自的文字书写，标出语言让读屏按正确的发音朗读。 */}
              <span lang={code}>{localeNames[code]}</span>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
