import { Button, Link } from "@heroui/react";
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

/** 在个人中心为企业成员管理专用生图 Key 和豆包连接地址。 */
export function AccountImageAutomation({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountImageAutomationMessages);
  const locale = useLocale();
  const client = useQueryClient();
  const [key, setKey] = useState<string>();
  const updating = useRef(false);
  const queryKey = ["image-automation-key", account.organizationId, account.userId];
  const status = useQuery({
    queryKey,
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
  const api = new URL(`/api/v1${imageAutomationPath}/generations`, window.location.origin).href;
  return (
    <div className="account-settings-section">
      <SettingsGroup title={t.keyTitle} description={t.keyScope}>
        <SettingsRow
          label={expiry}
          {...(expires && { hint: t.rotateHint })}
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
        {expires && (
          <SettingsRow
            label={t.revoke}
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
        {(change.isError || status.isError) && <p role="alert">{t.failed}</p>}
      </SettingsGroup>
      <SettingsGroup title={t.connector} description={t.connectorHint}>
        <AutomationAddress label={t.mcp} address={mcp} copy={t.copyAddress} />
        <AutomationAddress label={t.api} address={api} copy={t.copyAddress} />
        <SettingsRow
          label={t.download}
          action={
            <Link href={skillPath} download="lycobo-image.zip">
              {t.download}
            </Link>
          }
        />
      </SettingsGroup>
    </div>
  );
}

function AutomationAddress({
  label,
  address,
  copy,
}: {
  label: string;
  address: string;
  copy: string;
}) {
  return (
    <SettingsRow
      label={label}
      value={<code className="settings-automation-value">{address}</code>}
      action={
        <Button
          size="sm"
          variant="secondary"
          aria-label={`${copy} ${label}`}
          onPress={() => void copyToClipboard(address)}
        >
          {copy}
        </Button>
      }
    />
  );
}
