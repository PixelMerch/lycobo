import { Button, Label, ListBox, Select, Tabs } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconArrowUpRight, IconCrown } from "@tabler/icons-react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { BillingRecords } from "./billing-records";
import { useRechargeOrders, useWallet, useWalletEntries } from "./wallet-client";

import "./billing-records.css";

const names = {
  opening: "期初余额",
  consume: "图片生成",
  refund: "生成失败退款",
  recharge: "充值到账",
  checkin: "签到奖励",
};
const statuses = { pending: "待支付", paid: "已到账", closed: "已关闭" };
const kinds = [
  { id: "all", name: "全部类型" },
  ...Object.entries(names).map(([id, name]) => ({ id, name })),
];

export function WalletPanel({
  onMembership,
  onRecharge,
}: {
  onMembership: () => void;
  onRecharge: () => void;
}) {
  const wallet = useWallet();
  const entries = useWalletEntries();
  const recharges = useRechargeOrders();
  const [kind, setKind] = useState("all");
  useErrorToast((wallet.error ?? entries.error ?? recharges.error)?.message);
  const ledger = entries.data?.pages.flatMap((page) => page.data) ?? [];
  const visible = ledger.filter((entry) => kind === "all" || entry.kind === kind);
  const orders = recharges.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <div className="account-wallet">
      <div className="billing-overview">
        <div className="billing-balance">
          <span>可用积分</span>
          <strong>
            <CreditCoin size="action" />
            {wallet.data?.balance.toLocaleString("zh-CN") ?? "—"}
          </strong>
          <p>每张 {imageUnitCredits} 积分 · 生成失败按张退回</p>
        </div>
        <div className="account-wallet-actions">
          <Button size="sm" variant="secondary" onPress={onMembership}>
            <UiIcon icon={IconCrown} />
            会员方案
          </Button>
          <Button size="sm" variant="primary" onPress={onRecharge}>
            充值积分
            <UiIcon icon={IconArrowUpRight} />
          </Button>
        </div>
      </div>
      <Tabs defaultSelectedKey="ledger" variant="secondary" className="account-ledger-tabs">
        <Tabs.ListContainer>
          <Tabs.List aria-label="账单记录">
            <Tabs.Tab id="ledger">
              收支明细
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="orders">
              充值订单
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="ledger">
          <div className="account-ledger-controls">
            <Select
              aria-label="收支类型"
              value={kind}
              onChange={(key) => setKind(String(key))}
              className="account-ledger-filter"
            >
              <Label className="sr-only">收支类型</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {kinds.map((item) => (
                    <ListBox.Item key={item.id} id={item.id} textValue={item.name}>
                      {item.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <span>已加载 {ledger.length} 条记录</span>
          </div>
          <BillingRecords
            label="积分收支明细"
            records={visible.map((entry) => ({
              id: entry.id,
              title: names[entry.kind],
              detail: [
                entry.user_uid ? `UID ${entry.user_uid}` : null,
                entry.task_id ? `任务 ${entry.task_id}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              createdAt: entry.created_at,
              amount: `${entry.amount > 0 ? "+" : ""}${entry.amount.toLocaleString("zh-CN")} 积分`,
              balance: `结余 ${entry.balance_after.toLocaleString("zh-CN")}`,
              positive: entry.amount > 0,
            }))}
            emptyMessage={
              entries.isPending
                ? "正在加载收支记录…"
                : entries.isError
                  ? "收支记录暂时不可用"
                  : kind === "all"
                    ? "暂无收支记录"
                    : "已加载记录中暂无此类型"
            }
          />
          <div className="account-table-footer">
            <span>
              显示 {visible.length} 条{entries.hasNextPage ? "，可继续加载" : ""}
            </span>
            <InfiniteLoad
              hasMore={entries.hasNextPage}
              isLoading={entries.isFetchingNextPage}
              isError={entries.isError}
              onLoadMore={() => entries.fetchNextPage({ cancelRefetch: false })}
            />
            {entries.isError && (
              <Button size="sm" variant="secondary" onPress={() => void entries.refetch()}>
                重新加载收支
              </Button>
            )}
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="orders">
          <BillingRecords
            label="充值订单记录"
            records={orders.map((order) => ({
              id: order.id,
              title: `充值 ${order.credits.toLocaleString("zh-CN")} 积分`,
              detail: `UID ${order.user_uid} · 订单 ${order.id}`,
              createdAt: order.created_at,
              amount: `¥${(order.amount_minor / 100).toFixed(2)}`,
              balance: statuses[order.status],
              positive: order.status === "paid",
            }))}
            emptyMessage={
              recharges.isPending
                ? "正在加载订单…"
                : recharges.isError
                  ? "订单记录暂时不可用"
                  : "暂无订单记录"
            }
          />
          <div className="account-table-footer">
            <span>已加载 {orders.length} 条订单</span>
            <InfiniteLoad
              hasMore={recharges.hasNextPage}
              isLoading={recharges.isFetchingNextPage}
              isError={recharges.isError}
              onLoadMore={() => recharges.fetchNextPage({ cancelRefetch: false })}
            />
            {recharges.isError && (
              <Button size="sm" variant="secondary" onPress={() => void recharges.refetch()}>
                重新加载订单
              </Button>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
