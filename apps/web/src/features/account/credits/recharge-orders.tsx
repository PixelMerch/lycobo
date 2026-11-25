import { Button, Chip, Table, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { channelName, formatCredits, orderStatusName, recordTime } from "../account-format";
import { useRechargeOrders } from "../wallet-client";
import { creditsMessages } from "./credits-messages";

const filters = ["all", "paid", "pending", "closed"] as const;
const statusColors = { paid: "success", pending: "warning", closed: "default" } as const;

/** 充值订单表：按状态筛选已加载的订单，积分到账以收支明细为准。 */
export function RechargeOrders() {
  const t = useMessages(creditsMessages);
  const locale = useLocale();
  const recharges = useRechargeOrders();
  const [status, setStatus] = useState("all");
  useErrorToast(recharges.error?.message);
  const orders = recharges.data?.pages.flatMap((page) => page.data) ?? [];
  const visible = orders.filter((order) => status === "all" || order.status === status);
  const availableMessage = orders.length ? t.noOrdersOfStatus : t.noOrders;
  const errorMessage = recharges.isError ? t.ordersUnavailable : availableMessage;
  const rechargesStatusText = recharges.isPending ? t.loadingOrders : errorMessage;
  return (
    <section className="account-orders" aria-label={t.orders}>
      <div className="account-toolbar">
        <ToggleButtonGroup
          aria-label={t.orderStatus}
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[status]}
          onSelectionChange={(keys) => {
            const next = filters.find((id) => keys.has(id));
            if (next) setStatus(next);
          }}
          className="account-segment"
        >
          {filters.map((id) => (
            <ToggleButton key={id} id={id}>
              {t.orderFilters[id]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <span className="account-toolbar-meta">{t.ordersMeta(orders.length)}</span>
      </div>
      <div className="account-table-card">
        <Table variant="secondary" className="account-table account-orders-table">
          <Table.ScrollContainer>
            <Table.Content aria-label={t.ordersTable}>
              <Table.Header>
                <Table.Column className="account-col-time">{t.orderColumns.time}</Table.Column>
                <Table.Column isRowHeader className="account-col-order">
                  {t.orderColumns.order}
                </Table.Column>
                <Table.Column className="account-col-credits">
                  {t.orderColumns.credits}
                </Table.Column>
                <Table.Column className="account-col-price">{t.orderColumns.price}</Table.Column>
                <Table.Column className="account-col-channel">
                  {t.orderColumns.channel}
                </Table.Column>
                <Table.Column className="account-col-status">{t.orderColumns.status}</Table.Column>
                <Table.Column className="account-col-paid">{t.orderColumns.paid}</Table.Column>
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
                      {recordTime(order.created_at, locale)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-order">
                      {order.id.slice(0, 8).toUpperCase()}
                    </Table.Cell>
                    <Table.Cell className="account-cell-credits">
                      {t.orderCredits(formatCredits(order.credits))}
                    </Table.Cell>
                    <Table.Cell className="account-cell-price">
                      ¥{(order.amount_minor / 100).toFixed(2)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-channel">
                      {channelName(order.channel, locale)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-status">
                      <Chip
                        size="sm"
                        color={statusColors[order.status]}
                        className="account-status-chip"
                      >
                        {orderStatusName(order.status, locale)}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="account-cell-paid">
                      {order.paid_at ? recordTime(order.paid_at, locale) : "—"}
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
          <span>{t.shownOrders(visible.length)}</span>
          {recharges.isError && (
            <Button size="sm" variant="secondary" onPress={() => void recharges.refetch()}>
              {t.reloadOrders}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
