import { Button, Form, Input, Label, TextField, toast } from "@heroui/react";
import {
  type EnterpriseIdentity,
  enterpriseIdentitySchema,
  userNicknameChangeSchema,
} from "@lycoboai/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { normalizeApiResponse } from "../../../lib/api-response";
import { useErrorToast } from "../../../lib/error-toast";
import { sessionFetch } from "../../../lib/session-fetch";
import { enterpriseSessionKey } from "../../auth/auth-client";
import { accountSettingsMessages } from "./account-settings-messages";

/** 编辑当前账户的昵称并同步菜单与头像。 */
export function AccountNicknameEditor({ account }: { account: EnterpriseIdentity }) {
  const t = useMessages(accountSettingsMessages);
  const client = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? account.nickname ?? "";
  const input = userNicknameChangeSchema.safeParse({ nickname: value });
  const save = useMutation({
    retry: false,
    mutationFn: async (nickname: string) => {
      const response = await sessionFetch("/api/v1/auth/nickname", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(t.nicknameSaveFailed);
      const normalized = await normalizeApiResponse(response);
      const user = enterpriseIdentitySchema.parse(await normalized.json());
      if (user.userId !== account.userId || user.nickname !== nickname)
        throw new Error(t.nicknameSaveFailed);
      return nickname;
    },
    onSuccess: async (nickname) => {
      await client.cancelQueries({ queryKey: enterpriseSessionKey });
      client.setQueryData<EnterpriseIdentity | null>(enterpriseSessionKey, (current) =>
        current?.userId === account.userId ? { ...current, nickname } : current,
      );
      setDraft(null);
      toast.success(t.nicknameSaved);
    },
  });
  useErrorToast(save.isError ? t.nicknameSaveFailed : undefined);
  const canSave = input.success && input.data.nickname !== account.nickname && !save.isPending;
  return (
    <Form
      className="settings-nickname-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (input.success && canSave) save.mutate(input.data.nickname);
      }}
    >
      <TextField name="nickname" value={value} onChange={setDraft} isDisabled={save.isPending}>
        <Label className="visually-hidden">{t.nickname}</Label>
        <Input maxLength={64} autoComplete="nickname" placeholder={t.nicknamePlaceholder} />
      </TextField>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        isDisabled={!canSave}
        isPending={save.isPending}
      >
        {t.saveNickname}
      </Button>
    </Form>
  );
}
