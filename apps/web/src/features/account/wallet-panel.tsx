import { Button, Label, ListBox, Select, Table, Tabs } from "@heroui/react";
import { useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { useErrorToast } from "../../lib/error-toast";
import { useRechargeOrders, useWallet, useWalletEntries } from "./wallet-client";

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

export function WalletPanel() {
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
      <div className="account-wallet-heading">
        <div>
          <span>企业金币余额</span>
          <strong>
            <CreditCoin size="action" />
            {wallet.data?.balance ?? "—"}
          </strong>
        </div>
        <div className="account-wallet-actions">
          <Button size="sm" variant="secondary" isDisabled>
            充值积分
          </Button>
          <Button size="sm" variant="primary" isDisabled>
            订阅会员
          </Button>
        </div>
      </div>
      <div className="account-wallet-summary">
        <div>
          <span>积分使用范围</span>
          <strong>企业成员共享</strong>
        </div>
        <div>
          <span>图片生成价格</span>
          <strong>每张 20 币</strong>
        </div>
        <div>
          <span>失败结算</span>
          <strong>按张退回积分</strong>
        </div>
      </div>
      <p className="account-note">提交时扣费，生成失败按张退回。订阅与在线充值暂未开放。</p>
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
          <Table className="account-ledger-table">
            <Table.ScrollContainer>
              <Table.Content aria-label="积分收支明细">
                <Table.Header>
                  <Table.Column isRowHeader>详情</Table.Column>
                  <Table.Column>日期</Table.Column>
                  <Table.Column>积分变动</Table.Column>
                  <Table.Column>结余</Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <div className="account-table-empty">
                      {entries.isPending
                        ? "正在加载收支记录…"
                        : entries.isError
                          ? "收支记录暂时不可用"
                          : kind === "all"
                            ? "暂无收支记录"
                            : "已加载记录中暂无此类型"}
                    </div>
                  )}
                >
                  {visible.map((entry) => (
                    <Table.Row key={entry.id} id={entry.id}>
                      <Table.Cell>
                        <strong>{names[entry.kind]}</strong>
                        <small>
                          {entry.user_uid ? `用户 ${entry.user_uid}` : "企业账户"}
                          {entry.task_id ? ` · ${entry.task_id}` : ""}
                        </small>
                      </Table.Cell>
                      <Table.Cell>{new Date(entry.created_at).toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        <span className={entry.amount > 0 ? "account-amount-positive" : undefined}>
                          {entry.amount > 0 ? "+" : ""}
                          {entry.amount} 币
                        </span>
                      </Table.Cell>
                      <Table.Cell>{entry.balance_after} 币</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <div className="account-table-footer">
            <span>
              显示 {visible.length} 条{entries.hasNextPage ? "，可继续加载" : ""}
            </span>
            {entries.hasNextPage && (
              <Button
                size="sm"
                variant="secondary"
                isPending={entries.isFetchingNextPage}
                onPress={() => void entries.fetchNextPage()}
              >
                加载更多收支
              </Button>
            )}
            {entries.isError && (
              <Button size="sm" variant="secondary" onPress={() => void entries.refetch()}>
                重新加载收支
              </Button>
            )}
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="orders">
          <Table className="account-ledger-table">
            <Table.ScrollContainer>
              <Table.Content aria-label="充值订单记录">
                <Table.Header>
                  <Table.Column isRowHeader>详情</Table.Column>
                  <Table.Column>日期</Table.Column>
                  <Table.Column>订单号</Table.Column>
                  <Table.Column>价格</Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <div className="account-table-empty">
                      {recharges.isPending
                        ? "正在加载订单…"
                        : recharges.isError
                          ? "订单记录暂时不可用"
                          : "暂无订单记录"}
                    </div>
                  )}
                >
                  {orders.map((order) => (
                    <Table.Row key={order.id} id={order.id}>
                      <Table.Cell>
                        <strong>充值 {order.credits} 币</strong>
                        <small>
                          {statuses[order.status]} · 用户 {order.user_uid}
                        </small>
                      </Table.Cell>
                      <Table.Cell>{new Date(order.created_at).toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        <span className="account-order-id" title={order.id}>
                          {order.id}
                        </span>
                      </Table.Cell>
                      <Table.Cell>¥{(order.amount_minor / 100).toFixed(2)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <div className="account-table-footer">
            <span>已加载 {orders.length} 条订单</span>
            {recharges.hasNextPage && (
              <Button
                size="sm"
                variant="secondary"
                isPending={recharges.isFetchingNextPage}
                onPress={() => void recharges.fetchNextPage()}
              >
                加载更多充值
              </Button>
            )}
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
