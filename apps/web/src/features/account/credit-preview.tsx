import { Button } from "@heroui/react";
import { IconArrowUpRight, IconChevronRight } from "@tabler/icons-react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { useWallet, useWalletEntries } from "./wallet-client";

const entryNames = {
  opening: "期初余额",
  consume: "图片生成",
  refund: "生成失败退款",
  recharge: "充值到账",
  checkin: "签到奖励",
};

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
  return (
    <div className="credit-preview">
      <div className="credit-preview-balance">
        <div>
          <span>企业共享积分</span>
          <strong>
            <CreditCoin />
            {wallet.data?.balance.toLocaleString("zh-CN") ?? "—"}
          </strong>
        </div>
        <Button size="sm" variant="secondary" onPress={onRecharge}>
          充值积分
        </Button>
      </div>
      {wallet.isError && <p className="credit-preview-empty">余额暂不可用，请在积分明细中重试。</p>}
      <div className="credit-preview-heading">
        <span>最近记录</span>
        <Button size="sm" variant="ghost" onPress={onDetails}>
          查看积分明细
          <UiIcon icon={IconArrowUpRight} size="small" />
        </Button>
      </div>
      {recent.length > 0 ? (
        <ul className="credit-preview-records">
          {recent.map((entry) => (
            <li key={entry.id}>
              <div>
                <span>{entryNames[entry.kind]}</span>
                <small>
                  {new Date(entry.created_at).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
              <strong data-positive={entry.amount > 0}>
                {entry.amount > 0 ? "+" : ""}
                {entry.amount}
              </strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="credit-preview-empty" role="status">
          {entries.isPending
            ? "正在加载记录…"
            : entries.isError
              ? "记录暂不可用，请查看积分明细"
              : "暂无积分记录"}
        </p>
      )}
      <div className="credit-preview-footer">
        <span>会员权益与积分用量，分别管理</span>
        <Button size="sm" variant="ghost" onPress={onMembership}>
          了解会员
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </div>
    </div>
  );
}
