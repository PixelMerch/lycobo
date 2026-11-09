import { Button, Chip } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconChevronRight, IconCrown, IconPlus } from "@tabler/icons-react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { EntryMark } from "../account-entry";
import {
  entryDetail,
  entryNames,
  formatCredits,
  imagesFor,
  recordTime,
  signedCredits,
} from "../account-format";
import { useWallet, useWalletEntries } from "../wallet-client";
import "../account-common.css";

/** Balance as images it can buy, the one recharge action, three real records and membership. */
export function CreditPreview({
  onRecharge,
  onDetails,
  onMembership,
}: {
  onRecharge: () => void;
  onDetails: () => void;
  onMembership: () => void;
}) {
  const wallet = useWallet();
  const entries = useWalletEntries();
  const recent = entries.data?.pages[0]?.data.slice(0, 3) ?? [];
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  const errorMessage = entries.isError ? "记录暂不可用，请查看积分明细" : "暂无积分记录";
  const entriesStatusText = entries.isPending ? "正在加载记录…" : errorMessage;
  return (
    <div className="credit-preview">
      <div className="credit-preview-head">
        <span>
          <CreditCoin size="default" />
          企业共享积分
        </span>
        <Chip size="sm" className="account-chip">
          全员共用
        </Chip>
      </div>
      <strong className="credit-preview-balance">
        {balance === undefined ? "—" : formatCredits(balance)}
      </strong>
      <p className="credit-preview-facts">
        每张 {unit} 积分
        {balance === undefined ? "" : ` · 约可生成 ${formatCredits(imagesFor(balance, unit))} 张`} ·
        失败按张退回
      </p>
      {wallet.isError && <p className="credit-preview-empty">余额暂不可用，请在积分明细中重试。</p>}
      <Button variant="primary" className="credit-preview-recharge" onPress={onRecharge}>
        <UiIcon icon={IconPlus} />
        充值积分
      </Button>
      <div className="credit-preview-heading">
        <span>最近记录</span>
        <Button size="sm" variant="ghost" onPress={onDetails}>
          全部明细
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </div>
      {recent.length > 0 ? (
        <ul className="credit-preview-records">
          {recent.map((entry) => (
            <li key={entry.id}>
              <EntryMark kind={entry.kind} />
              <div>
                <span>{entryNames[entry.kind]}</span>
                <small>
                  {recordTime(entry.created_at)} · {entryDetail(entry)}
                </small>
              </div>
              <strong data-positive={entry.amount > 0}>{signedCredits(entry.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="credit-preview-empty" role="status">
          {entriesStatusText}
        </p>
      )}
      <div className="credit-preview-footer">
        <UiIcon icon={IconCrown} className="credit-preview-crown" />
        <span>会员</span>
        <Chip size="sm" className="account-chip">
          未开通
        </Chip>
        <Button size="sm" variant="ghost" className="credit-preview-member" onPress={onMembership}>
          查看方案
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </div>
    </div>
  );
}
