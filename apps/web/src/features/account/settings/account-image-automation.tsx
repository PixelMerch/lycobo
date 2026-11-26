import { Button, Disclosure, Link } from "@heroui/react";
import {
  type EnterpriseIdentity,
  imageAutomationKeyIssuedSchema,
  imageAutomationKeyStatusSchema,
  imageAutomationMcpPath,
  imageAutomationPath,
} from "@lycoboai/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { copyToClipboard } from "../../../lib/clipboard";
import { imageRequest } from "../../generation/image-request";
import { accountImageAutomationMessages } from "./account-image-automation-messages";
import { SettingsGroup, SettingsRow } from "./account-settings-rows";

const keyPath = `${imageAutomationPath.slice(1)}/key`;
const skillPath = "/integrations/doubao/lycobo-image.zip";
// 豆包桌面版的注册协议会将客户端的聊天窗口带到前台。
const doubaoDesktopUrl = "doubaoapp://active-chat";

/** 为企业成员提供豆包客户端入口，首次连接时再加载生图 Key 设置。 */
export function AccountImageAutomation({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountImageAutomationMessages);
  const locale = useLocale();
  const client = useQueryClient();
  const [hasOpenedSetup, setHasOpenedSetup] = useState(false);
  const [key, setKey] = useState<string>();
  const updating = useRef(false);
  const queryKey = ["image-automation-key", account.organizationId, account.userId];
  const status = useQuery({
    queryKey,
    enabled: hasOpenedSetup,
    retry: false,
    queryFn: async ({ signal }) =>
      imageAutomationKeyStatusSchema.parse(await (await imageRequest(keyPath, { signal })).json()),
  });
  const change = useMutation({
    gcTime: 0,
    onMutate: () => setKey(undefined),
    mutationFn: async (method: "POST" | "DELETE") => {
      const response = await (await imageRequest(keyPath, { method })).json();
      if (method === "DELETE") return imageAutomationKeyStatusSchema.parse(response);
      // 明文仅留在当前面板，不进入请求缓存或浏览器持久存储。
      const issued = imageAutomationKeyIssuedSchema.parse(response);
      setKey(issued.key);
      return { expiresAt: issued.expiresAt };
    },
    onSuccess: (updated) => client.setQueryData(queryKey, updated),
    onSettled: () => {
      updating.current = false;
    },
  });
  const changeKey = (method: "POST" | "DELETE") => {
    // 防止一次连点造成连续轮换，先返回的 Key 可能立刻失效。
    if (updating.current) return;
    updating.current = true;
    change.mutate(method);
  };
  const expires = status.data?.expiresAt;
  const inactive = status.isPending ? t.loading : t.inactive;
  const expiry = expires
    ? t.activeUntil(
        new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(expires)),
      )
    : inactive;
  const mcp = new URL(`/api/v1${imageAutomationMcpPath}`, window.location.origin).href;
  return (
    <div className="account-settings-section">
      <SettingsGroup title={t.title} description={t.description}>
        <SettingsRow
          label={t.doubaoDesktop}
          hint={t.desktopRequired}
          action={
            <Link className="settings-automation-link" href={doubaoDesktopUrl}>
              {t.openDoubao}
              <Link.Icon />
            </Link>
          }
        />
        <Disclosure
          className="settings-automation-setup"
          onExpandedChange={(expanded) => {
            if (expanded) setHasOpenedSetup(true);
          }}
        >
          <Disclosure.Heading level={4}>
            <Disclosure.Trigger className="settings-row">
              <span className="settings-row-label">{t.setup}</span>
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <p className="settings-automation-hint">{t.setupHint}</p>
            <SettingsRow
              label={t.connection}
              action={
                <Button size="sm" variant="secondary" onPress={() => void copyToClipboard(mcp)}>
                  {t.copyAddress}
                </Button>
              }
            />
            <SettingsRow
              label={t.keyTitle}
              hint={expiry}
              action={
                status.isError ? (
                  <Button size="sm" variant="secondary" onPress={() => void status.refetch()}>
                    {t.retry}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={status.isPending || change.isPending}
                    onPress={() => changeKey("POST")}
                  >
                    {expires ? t.rotate : t.issue}
                  </Button>
                )
              }
            />
            {key && (
              <SettingsRow
                label={t.issued}
                value={<code className="settings-automation-value">{key}</code>}
                action={
                  <Button size="sm" variant="secondary" onPress={() => void copyToClipboard(key)}>
                    {t.copyKey}
                  </Button>
                }
              />
            )}
            <SettingsRow
              label={t.skill}
              action={
                <Link
                  className="settings-automation-link"
                  href={skillPath}
                  download="lycobo-image.zip"
                >
                  {t.download}
                </Link>
              }
            />
            {expires && (
              <SettingsRow
                label={t.rotateHint}
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={change.isPending}
                    onPress={() => changeKey("DELETE")}
                  >
                    {t.revoke}
                  </Button>
                }
              />
            )}
            {(change.isError || status.isError) && (
              <p className="settings-automation-hint" role="alert">
                {t.failed}
              </p>
            )}
          </Disclosure.Content>
        </Disclosure>
      </SettingsGroup>
    </div>
  );
}
