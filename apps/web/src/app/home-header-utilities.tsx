import { Button, Tooltip } from "@heroui/react";
import { IconBook, IconFolder, IconGift } from "@tabler/icons-react";
import { type ReactNode, useRef } from "react";
import { UiIcon } from "../components/ui-icon";
import { useAccountOverlays } from "../features/account/account-overlay-store";
import { useOpenAssetLibrary } from "../features/assets/asset-library-store";
import { useRequireLogin } from "../features/auth/login-prompt";
import { useMessages } from "../i18n/messages";
import { shellMessages } from "./shell-messages";

/** 首页工具栏连接会员、创作说明、消息、素材库与语言。 */
export function HomeHeaderUtilities({
  messages,
  children,
  onNavigate,
}: {
  messages?: ReactNode;
  children?: ReactNode;
  onNavigate?: () => void;
}) {
  const t = useMessages(shellMessages);
  const requireLogin = useRequireLogin();
  const openAccount = useAccountOverlays((state) => state.open);
  const openLibrary = useOpenAssetLibrary();
  const gift = useRef<HTMLButtonElement>(null);
  const assets = useRef<HTMLButtonElement>(null);

  return (
    <div className="home-header-utilities">
      <Tooltip delay={200}>
        <Button
          ref={gift}
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label={t.benefits}
          className="home-header-tool"
          onPress={() => {
            onNavigate?.();
            if (requireLogin()) openAccount("membership", onNavigate ? null : gift.current);
          }}
        >
          <UiIcon icon={IconGift} size="navigation" />
        </Button>
        <Tooltip.Content placement="bottom">{t.benefits}</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={200}>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label={t.creationHelp}
          className="home-header-tool"
        >
          <UiIcon icon={IconBook} size="navigation" />
        </Button>
        <Tooltip.Content className="home-header-help" placement="bottom end">
          <b>{t.creationHelp}</b>
          <ul>
            {t.creationHelpItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Tooltip.Content>
      </Tooltip>
      {messages}
      {children}
      <Button
        ref={assets}
        size="sm"
        variant="tertiary"
        aria-label={t.assets}
        className="home-header-tool"
        onPress={() => {
          onNavigate?.();
          openLibrary(onNavigate ? null : assets.current);
        }}
      >
        <UiIcon icon={IconFolder} size="navigation" />
        <span className="home-header-tool-label">{t.assets}</span>
      </Button>
    </div>
  );
}
