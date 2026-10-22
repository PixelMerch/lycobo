import { Button } from "@heroui/react";
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
export function WalletPanel() {
  const wallet = useWallet();
  const entries = useWalletEntries();
  const recharges = useRechargeOrders();
  useErrorToast((wallet.error ?? entries.error ?? recharges.error)?.message);
  return (
    <>
      <div className="credit-balance">
        <div>
          <small>企业金币余额</small>
          <strong>{wallet.data?.balance ?? "—"}</strong>
        </div>
        <span>每张 20 币</span>
      </div>
      <p className="account-note">
        主账号与子账号共享余额。提交时扣费，生成失败按张退回。充值支付暂未开放。
      </p>
      <h3>收支明细</h3>
      <dl className="account-rows">
        {entries.data?.pages
          .flatMap((page) => page.data)
          .map((entry) => (
            <div key={entry.id}>
              <dt>
                {names[entry.kind]}
                <small>
                  {new Date(entry.created_at).toLocaleString()}
                  {entry.user_uid ? ` · 用户 ${entry.user_uid}` : ""}
                  {entry.task_id ? ` · ${entry.task_id}` : ""}
                </small>
              </dt>
              <dd>
                {entry.amount > 0 ? "+" : ""}
                {entry.amount} 币<small>余额 {entry.balance_after} 币</small>
              </dd>
            </div>
          ))}
      </dl>
      {entries.isSuccess && !entries.data.pages[0]?.data.length && (
        <p className="account-note">暂无收支记录</p>
      )}
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
      <h3>充值明细</h3>
      <dl className="account-rows">
        {recharges.data?.pages
          .flatMap((page) => page.data)
          .map((order) => (
            <div key={order.id}>
              <dt>
                {order.credits} 币 · ¥{(order.amount_minor / 100).toFixed(2)}
                <small>{new Date(order.created_at).toLocaleString()}</small>
              </dt>
              <dd>{statuses[order.status]}</dd>
            </div>
          ))}
      </dl>
      {recharges.isSuccess && !recharges.data.pages[0]?.data.length && (
        <p className="account-note">暂无充值记录</p>
      )}
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
    </>
  );
}
