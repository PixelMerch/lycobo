import { Button, Description, Input, Label, Tabs, TextField } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconChevronRight, IconLink, IconMail, IconPhone } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";

export function AccountManagement({ account }: { account: EnterpriseIdentity | null | undefined }) {
  return (
    <Tabs className="account-management" defaultSelectedKey="bindings" variant="secondary">
      <Tabs.ListContainer>
        <Tabs.List aria-label="账号设置">
          <Tabs.Tab id="bindings">
            账号绑定
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="password">
            重置密码
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="bindings">
        <div className="account-management-summary">
          <span>企业账号</span>
          <strong>{account?.account ?? "—"}</strong>
          {account?.uid && <small>UID {account.uid}</small>}
        </div>
        <div className="account-binding-list">
          {[
            { label: "手机号", icon: IconPhone, description: "手机绑定暂未开放" },
            { label: "邮箱", icon: IconMail, description: "邮箱绑定暂未开放" },
          ].map((binding) => (
            <section
              className="account-binding-card"
              key={binding.label}
              aria-label={binding.label}
            >
              <div className="account-binding-heading">
                <h3>
                  <UiIcon icon={binding.icon} />
                  {binding.label}
                </h3>
                <span className="account-status">未开通</span>
              </div>
              <div className="account-binding-action">
                <p>{binding.description}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled
                  aria-label={`绑定${binding.label}`}
                >
                  <UiIcon icon={IconLink} size="small" />
                  绑定
                </Button>
              </div>
            </section>
          ))}
        </div>
        <p className="account-note">当前使用企业账号登录，账号与权限由管理员统一管理。</p>
      </Tabs.Panel>
      <Tabs.Panel id="password">
        <section className="account-reset-card" aria-label="重置密码">
          <ol className="account-reset-steps" aria-label="密码重置步骤">
            <li aria-current="step">
              <span>1</span>确认账号
            </li>
            <li aria-hidden="true">
              <UiIcon icon={IconChevronRight} />
            </li>
            <li>
              <span>2</span>重置密码
            </li>
          </ol>
          <TextField isReadOnly value={account?.account ?? ""} className="account-field">
            <Label>企业账号</Label>
            <Input autoComplete="username" />
          </TextField>
          <TextField isDisabled className="account-field">
            <Label>验证码</Label>
            <div className="account-verification-row">
              <Input placeholder="请输入 6 位验证码" inputMode="numeric" maxLength={6} />
              <Button variant="tertiary" size="sm" isDisabled>
                发送验证码
              </Button>
            </div>
            <Description>企业账号由管理员重置密码，暂不支持验证码自助重置。</Description>
          </TextField>
          <div className="account-reset-actions">
            <Button variant="primary" isDisabled>
              确认
            </Button>
          </div>
        </section>
      </Tabs.Panel>
    </Tabs>
  );
}
