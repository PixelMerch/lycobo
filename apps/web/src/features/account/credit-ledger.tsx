import {
  Button,
  Label,
  ListBox,
  Select,
  Table,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useState } from "react";
import { InfiniteLoad } from "../../components/infinite-load";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseSession } from "../auth/auth-client";
import { EntryMark } from "./account-entry";
import {
  entryDetail,
  entryNames,
  formatCredits,
  memberLabel,
  recordTime,
  signedCredits,
} from "./account-format";
import { useWallet, useWalletEntries } from "./wallet-client";

const kinds = [
  { id: "all", name: "全部" },
  { id: "consume", name: "生成消耗" },
  { id: "refund", name: "失败退款" },
  { id: "recharge", name: "充值到账" },
  { id: "opening", name: "期初" },
];

/** Filters apply to loaded pages only; the ledger never infers totals from partial history. */
export function CreditLedger() {
  const session = useEnterpriseSession();
  const wallet = useWallet();
  const entries = useWalletEntries();
  const [kind, setKind] = useState("all");
  const [member, setMember] = useState("all");
  useErrorToast((wallet.error ?? entries.error)?.message);
  const ledger = entries.data?.pages.flatMap((page) => page.data) ?? [];
  const members = [...new Set(ledger.map((entry) => entry.user_uid ?? "system"))];
  const visible = ledger.filter(
    (entry) =>
      (kind === "all" || entry.kind === kind) &&
      (member === "all" || (entry.user_uid ?? "system") === member),
  );
  const currentUid = session.data?.uid;
  return (
    <section className="account-ledger" aria-label="积分明细">
      <div className="account-toolbar">
        <ToggleButtonGroup
          aria-label="收支类型"
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[kind]}
          onSelectionChange={(keys) => {
            const next = kinds.find((item) => keys.has(item.id));
            if (next) setKind(next.id);
          }}
          className="account-segment"
        >
          {kinds.map((item) => (
            <ToggleButton key={item.id} id={item.id}>
              {item.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {members.length > 1 && (
          <Select
            aria-label="成员"
            value={member}
            onChange={(key) => setMember(String(key))}
            className="account-member-filter"
          >
            <Label className="sr-only">成员</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {["all", ...members].map((uid) => {
                  const name =
                    uid === "all"
                      ? "全部成员"
                      : memberLabel(uid === "system" ? null : uid, currentUid);
                  return (
                    <ListBox.Item key={uid} id={uid} textValue={name}>
                      {name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  );
                })}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
        <span className="account-toolbar-meta">
          当前可用 <b>{wallet.data ? formatCredits(wallet.data.balance) : "—"}</b> 积分 · 已加载{" "}
          {ledger.length} 条
        </span>
      </div>
      <div className="account-table-card">
        <Table variant="secondary" className="account-table account-ledger-table">
          <Table.ScrollContainer>
            <Table.Content aria-label="积分收支明细">
              <Table.Header>
                <Table.Column className="account-col-time">时间</Table.Column>
                <Table.Column isRowHeader className="account-col-type">
                  类型
                </Table.Column>
                <Table.Column className="account-col-detail">说明</Table.Column>
                <Table.Column className="account-col-member">成员</Table.Column>
                <Table.Column className="account-col-amount">积分变动</Table.Column>
                <Table.Column className="account-col-after">结余</Table.Column>
              </Table.Header>
              <Table.Body
                items={visible}
                renderEmptyState={() => (
                  <p className="account-empty" role="status">
                    {entries.isPending
                      ? "正在加载收支记录…"
                      : entries.isError
                        ? "收支记录暂时不可用"
                        : ledger.length
                          ? "已加载记录中暂无此类型"
                          : "暂无收支记录"}
                  </p>
                )}
              >
                {(entry) => (
                  <Table.Row id={entry.id}>
                    <Table.Cell className="account-cell-time">
                      {recordTime(entry.created_at)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-type">
                      <span className="account-entry-type">
                        <EntryMark kind={entry.kind} />
                        {entryNames[entry.kind]}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="account-cell-detail">{entryDetail(entry)}</Table.Cell>
                    <Table.Cell className="account-cell-member">
                      {memberLabel(entry.user_uid, currentUid)}
                    </Table.Cell>
                    <Table.Cell
                      className={`account-cell-amount${entry.amount > 0 ? " is-positive" : ""}`}
                    >
                      {signedCredits(entry.amount)}
                    </Table.Cell>
                    <Table.Cell className="account-cell-after">
                      <span className="account-after-label">结余 </span>
                      {formatCredits(entry.balance_after)}
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <div className="account-table-footer">
          <InfiniteLoad
            hasMore={entries.hasNextPage}
            isLoading={entries.isFetchingNextPage}
            isError={entries.isError}
            onLoadMore={() => entries.fetchNextPage({ cancelRefetch: false })}
          />
          <span>
            显示 {visible.length} 条{entries.hasNextPage ? "，向下滚动加载更早记录" : ""} ·
            筛选仅针对已加载的记录
          </span>
          {entries.isError && (
            <Button size="sm" variant="secondary" onPress={() => void entries.refetch()}>
              重新加载收支
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
