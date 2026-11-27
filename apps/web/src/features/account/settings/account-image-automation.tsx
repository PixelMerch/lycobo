import { Button, Disclosure, Link } from "@heroui/react";
import {
  type EnterpriseIdentity,
  imageAutomationKeyCopyPath,
  imageAutomationKeyCopySchema,
  imageAutomationKeyIssuedSchema,
  imageAutomationKeyPath,
  imageAutomationKeyPrefix,
  imageAutomationKeyStatusSchema,
  imageAutomationMcpPath,
} from "@lycoboai/contracts";
import { IconRobot } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type RefObject, useRef, useState } from "react";
import { ValueSkeleton } from "../../../components/data-skeleton";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { copyToClipboard } from "../../../lib/clipboard";
import { imageRequest } from "../../generation/image-request";
import { accountImageAutomationMessages } from "./account-image-automation-messages";
import { SettingsGroup, SettingsRow } from "./account-settings-rows";

const keyPath = imageAutomationKeyPath.slice(1);
const keyCopyPath = imageAutomationKeyCopyPath.slice(1);
type KeyMethod = "POST" | "DELETE";

function useImageApiKey(account: EnterpriseIdentity, onIssued: () => void) {
  const client = useQueryClient();
  const copying = useRef(false);
  const [isCopying, setCopying] = useState(false);
  const updating = useRef(false);
  const queryKey = ["image-automation-key", account.organizationId, account.userId];
  const status = useQuery({
    queryKey,
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) =>
      imageAutomationKeyStatusSchema.parse(await (await imageRequest(keyPath, { signal })).json()),
  });
  const change = useMutation({
    gcTime: 0,
    mutationFn: async (method: KeyMethod) => {
      const response = await (await imageRequest(keyPath, { method })).json();
      if (method === "DELETE") return imageAutomationKeyStatusSchema.parse(response);
      // 缓存只保存状态，复制时才按需读取完整 Key。
      const issued = imageAutomationKeyIssuedSchema.parse(response);
      return { expiresAt: issued.expiresAt, lastFour: issued.key.slice(-4), copyable: true };
    },
    onSuccess: (updated, method) => {
      client.setQueryData(queryKey, updated);
      if (method === "POST") onIssued();
    },
    onSettled: () => {
      updating.current = false;
    },
  });
  const update = (method: KeyMethod) => {
    // 连点更换会让先返回的 Key 立即失效，只允许一次操作进行中。
    if (updating.current || copying.current) return;
    updating.current = true;
    change.mutate(method);
  };
  const copy = async (header: boolean) => {
    if (copying.current || updating.current) return;
    copying.current = true;
    setCopying(true);
    try {
      await copyToClipboard(async () => {
        const response = await imageRequest(keyCopyPath, { method: "POST" });
        const { key } = imageAutomationKeyCopySchema.parse(await response.json());
        return header ? `Bearer ${key}` : key;
      });
    } finally {
      copying.current = false;
      setCopying(false);
    }
  };
  return { status, copy, isCopying, update, saving: change.isPending, failed: change.isError };
}

/** 豆包应用行按需展开简短说明和配置操作。 */
function DoubaoConnection({
  copyable,
  isCopying,
  saving,
  onCopyHeader,
  expanded,
  onExpandedChange,
  onManageKey,
  triggerRef,
}: {
  copyable: boolean;
  isCopying: boolean;
  saving: boolean;
  onCopyHeader: () => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onManageKey: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useMessages(accountImageAutomationMessages);
  const copyAddress = () => {
    const url = new URL(`/api/v1${imageAutomationMcpPath}`, window.location.origin);
    void copyToClipboard(url.href);
  };
  return (
    <Disclosure
      className="settings-app-connection"
      isExpanded={expanded}
      onExpandedChange={onExpandedChange}
    >
      <div className="settings-row settings-app-row">
        <div className="settings-app-identity">
          <span className="settings-app-icon">
            <UiIcon icon={IconRobot} size="navigation" />
          </span>
          <div className="settings-row-text">
            <span className="settings-row-label">{t.doubao}</span>
            <span className="settings-row-hint">{t.doubaoUses}</span>
          </div>
        </div>
        <Disclosure.Heading level={4} className="settings-connection-heading">
          <Button ref={triggerRef} slot="trigger" size="sm" variant="secondary">
            {t.setup}
            <Disclosure.Indicator />
          </Button>
        </Disclosure.Heading>
      </div>
      <Disclosure.Content>
        <div className="settings-connection-details">
          <p className="settings-automation-hint">{t.setupHint}</p>
          <div className="settings-connection-actions">
            <Button size="sm" variant="secondary" onPress={copyAddress}>
              {t.copyAddress}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isPending={isCopying}
              isDisabled={saving}
              onPress={copyable ? onCopyHeader : onManageKey}
            >
              {copyable ? t.copyHeaderValue : t.goToKey}
            </Button>
          </div>
        </div>
      </Disclosure.Content>
    </Disclosure>
  );
}

function ImageApiKeyActions({
  credentials,
  onConfirm,
}: {
  credentials: ReturnType<typeof useImageApiKey>;
  onConfirm: (method: KeyMethod) => void;
}) {
  const t = useMessages(accountImageAutomationMessages);
  const { status, copy, isCopying, update, saving, failed } = credentials;
  const hasActiveKey = !!status.data?.expiresAt;
  return (
    <div className="settings-connection-details">
      <div className="settings-connection-actions">
        {status.isError ? (
          <Button
            size="sm"
            variant="secondary"
            onPress={() => void status.refetch()}
            isPending={status.isFetching}
          >
            {t.retry}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={status.isPending || saving || isCopying}
              onPress={() => (hasActiveKey ? onConfirm("POST") : update("POST"))}
            >
              {hasActiveKey ? t.rotate : t.issue}
            </Button>
            {hasActiveKey && (
              <Button
                size="sm"
                variant="ghost"
                isDisabled={saving || isCopying}
                onPress={() => onConfirm("DELETE")}
              >
                {t.revoke}
              </Button>
            )}
            {status.data?.copyable && (
              <Button
                size="sm"
                variant="ghost"
                isPending={isCopying}
                isDisabled={saving}
                onPress={() => void copy(false)}
              >
                {t.copyKey}
              </Button>
            )}
          </>
        )}
      </div>
      {failed && (
        <p className="settings-automation-hint" role="alert">
          {t.failed}
        </p>
      )}
    </div>
  );
}

/** 集中管理生图凭据，操作已有 Key 前确认影响。 */
function ImageApiCredentials({
  credentials,
  managing,
  onManagingChange,
  triggerRef,
}: {
  credentials: ReturnType<typeof useImageApiKey>;
  managing: boolean;
  onManagingChange: (managing: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useMessages(accountImageAutomationMessages);
  const locale = useLocale();
  const { status, update } = credentials;
  const [confirmation, setConfirmation] = useState<KeyMethod>();
  const expires = status.data?.expiresAt;
  const validity = expires
    ? t.activeUntil(
        new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(expires)),
      )
    : undefined;
  const statusText = validity ?? (status.isError ? t.statusFailed : t.inactive);
  const maskedKey = expires
    ? `${imageAutomationKeyPrefix}********${status.data?.lastFour ?? ""}`
    : undefined;
  const revoke = confirmation === "DELETE";
  return (
    <>
      <Disclosure
        className="settings-image-credentials"
        isExpanded={managing}
        onExpandedChange={onManagingChange}
      >
        <SettingsRow
          label={t.keyTitle}
          hint={status.isPending ? <ValueSkeleton label={t.loading} /> : statusText}
          value={
            maskedKey && (
              <>
                <span className="sr-only">{t.maskedKey}</span>
                <code className="settings-masked-key">{maskedKey}</code>
              </>
            )
          }
          action={
            <Disclosure.Heading level={4} className="settings-connection-heading">
              <Button ref={triggerRef} slot="trigger" size="sm" variant="secondary">
                {t.manageKey}
                <Disclosure.Indicator />
              </Button>
            </Disclosure.Heading>
          }
        />
        <Disclosure.Content>
          <ImageApiKeyActions credentials={credentials} onConfirm={setConfirmation} />
        </Disclosure.Content>
      </Disclosure>
      <ConfirmDialog
        isOpen={!!confirmation}
        title={revoke ? t.revoke : t.rotate}
        content={revoke ? t.revokeHint : t.rotateHint}
        confirmLabel={revoke ? t.revoke : t.rotate}
        tone={revoke ? "danger" : "default"}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => {
          if (!confirmation) return;
          setConfirmation(undefined);
          update(confirmation);
        }}
      />
    </>
  );
}

/** 企业应用连接统一展示应用、通用技能下载与生图 Key。 */
export function AccountImageAutomation({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountImageAutomationMessages);
  const skillFile = useLocale() === "en" ? "lycobo-image-en.zip" : "lycobo-image.zip";
  const [expanded, setExpanded] = useState<"doubao" | "key" | null>(null);
  const doubaoTrigger = useRef<HTMLButtonElement>(null);
  const keyTrigger = useRef<HTMLButtonElement>(null);
  const credentials = useImageApiKey(account, () => {
    setExpanded("doubao");
    doubaoTrigger.current?.focus();
  });
  return (
    <div className="account-settings-section">
      <SettingsGroup title={t.apps}>
        <DoubaoConnection
          copyable={credentials.status.data?.copyable === true}
          isCopying={credentials.isCopying}
          saving={credentials.saving}
          onCopyHeader={() => void credentials.copy(true)}
          expanded={expanded === "doubao"}
          onExpandedChange={(open) => setExpanded(open ? "doubao" : null)}
          triggerRef={doubaoTrigger}
          onManageKey={() => {
            setExpanded("key");
            keyTrigger.current?.focus();
          }}
        />
      </SettingsGroup>
      <SettingsGroup title={t.resources}>
        <SettingsRow
          label={t.skill}
          action={
            <Link
              className="settings-automation-link"
              href={`/integrations/${skillFile}`}
              download={skillFile}
            >
              {t.download}
            </Link>
          }
        />
        <ImageApiCredentials
          credentials={credentials}
          managing={expanded === "key"}
          onManagingChange={(open) => setExpanded(open ? "key" : null)}
          triggerRef={keyTrigger}
        />
      </SettingsGroup>
    </div>
  );
}
