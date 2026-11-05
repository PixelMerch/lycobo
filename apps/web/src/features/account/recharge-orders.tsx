import { Button, Chip, Table, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconReceipt } from "@tabler/icons-react";
import { useState } from "react";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { channelName, formatCredits, orderStatuses, recordTime } from "./account-format";
import { useRechargeOrders } from "./wallet-client";

const filters = [
  { id: "all", name: "全部" },
  { id: "paid", name: "已到账" },
  { id: "pending", name: "待支付" },
  { id: "closed", name: "已关闭" },
];
const statusColors = { paid: "success", pending: "warning", closed: "default" } as const;

export function RechargeOrders() {
  const recharges = useRechargeOrders();
  const [status, setStatus] = useState("all");
  useErrorToast(recharges.error?.message);
  const orders = recharges.data?.pages.flatMap((page) => page.data) ?? [];
  const visible = orders.filter((order) => status === "all" || order.status === status);
  const availableMessage = orders.length ? "已加载订单中暂无此状态" : "暂无充值订单";
  const errorMessage = recharges.isError ? "订单记录暂时不可用" : availableMessage;
  const rechargesStatusText = recharges.isPending ? "正在加载订单…" : errorMessage;
  return (
    <section className="account-orders" aria-label="充值订单">
      <div className="account-toolbar">
        <ToggleButtonGroup
          aria-label="订单状态"
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[status]}
          onSelectionChange={(keys) => {
            const next = filters.find((item) => keys.has(item.id));
            if (next) setStatus(next.id);
          }}
          className="account-segment"
        >
          {filters.map((item) => (
            <ToggleButton key={item.id} id={item.id}>
              {item.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <span className="account-toolbar-meta">
          积分到账以“积分明细”为准 · 已加载 {orders.length} 笔
        </span>
      </div>
      <div className="account-table-card">
        <Table variant="secondary" className="account-table account-orders-table">
          <Table.ScrollContainer>
            <Table.Content aria-label="充值订单记录">
              <Table.Header>
                <Table.Column className="account-col-time">下单时间</Table.Column>
                <Table.Column isRowHeader className="account-col-order">
                  订单号
                </Table.Column>
                <Table.Column className="account-col-credits">积分</Table.Column>
                <Table.Column className="account-col-price">金额</Table.Column>
                <Table.Column className="account-col-channel">渠道</Table.Column>
                <Table.Column className="account-col-status">状态</Table.Column>
                <Table.Column className="account-col-paid">到账时间</Table.Column>
              </Table.Header>
              <Table.Body
                items={visible}
                renderEmptyState={() => (
                  <p className="account-empty" role="status">
                    {rechargesStatusText}
                  </p>
                )}
              >
                {(order) => (
                  <Table.Row id={order.id}>
                    <Table.Cell className="account-cell-time">
                      {recordTime(order.created_at)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-order">
                      {order.id.slice(0, 8).toUpperCase()}
                    </Table.Cell>
                    <Table.Cell className="account-cell-credits">
                      {formatCredits(order.credits)} 积分
                    </Table.Cell>
                    <Table.Cell className="account-cell-price">
                      ¥{(order.amount_minor / 100).toFixed(2)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-channel">
                      {channelName(order.channel)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-status">
                      <Chip
                        size="sm"
                        color={statusColors[order.status]}
                        className="account-status-chip"
                      >
                        {orderStatuses[order.status]}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="account-cell-paid">
                      {order.paid_at ? recordTime(order.paid_at) : "—"}
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <div className="account-table-footer">
          <InfiniteLoad
            hasMore={recharges.hasNextPage}
            isLoading={recharges.isFetchingNextPage}
            isError={recharges.isError}
            onLoadMore={() => recharges.fetchNextPage({ cancelRefetch: false })}
          />
          <span>显示 {visible.length} 笔 · 筛选仅针对已加载的订单</span>
          {recharges.isError && (
            <Button size="sm" variant="secondary" onPress={() => void recharges.refetch()}>
              重新加载订单
            </Button>
          )}
        </div>
      </div>
      <div className="account-orders-note">
        <UiIcon icon={IconReceipt} size="navigation" />
        <div>
          <strong>在线支付开通后，订单状态将实时同步</strong>
          <p>当前订单由企业管理员充值生成；积分到账情况可在“积分明细”查看。</p>
        </div>
      </div>
    </section>
  );
}
