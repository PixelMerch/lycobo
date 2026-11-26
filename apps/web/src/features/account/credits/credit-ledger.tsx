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
import { InfiniteLoad } from "../../../components/infinite-load";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseSession } from "../../auth/auth-client";
import { EntryMark } from "../account-entry";
import {
  entryDetail,
  entryName,
  formatCredits,
  isPromptOptimization,
  memberLabel,
  recordTime,
  signedCredits,
  totalWalletCredits,
} from "../account-format";
import { useWallet, useWalletEntries } from "../wallet-client";
import { creditsMessages } from "./credits-messages";

const kinds = ["all", "consume", "refund", "recharge"] as const;

/** 积分收支明细表：筛选只作用于已加载的记录，不从部分历史推算合计。 */
export function CreditLedger() {
  const t = useMessages(creditsMessages);
  const locale = useLocale();
  const session = useEnterpriseSession();
  const wallet = useWallet();
  const balance = totalWalletCredits(wallet.data);
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
  const availableMessage = ledger.length ? t.noEntriesOfKind : t.noEntries;
  const errorMessage = entries.isError ? t.entriesUnavailable : availableMessage;
  const entriesStatusText = entries.isPending ? t.loadingEntries : errorMessage;
  return (
    <section className="account-ledger" aria-label={t.creditHistory}>
      <div className="account-toolbar">
        <ToggleButtonGroup
          aria-label={t.entryKind}
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[kind]}
          onSelectionChange={(keys) => {
            const next = kinds.find((id) => keys.has(id));
            if (next) setKind(next);
          }}
          className="account-segment"
        >
          {kinds.map((id) => (
            <ToggleButton key={id} id={id}>
              {t.ledgerKinds[id]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {members.length > 1 && (
          <Select
            aria-label={t.member}
            value={member}
            onChange={(key) => setMember(String(key))}
            className="account-member-filter"
          >
            <Label className="sr-only">{t.member}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {["all", ...members].map((uid) => {
                  const memberId = uid === "system" ? null : uid;
                  const name =
                    uid === "all" ? t.allMembers : memberLabel(memberId, currentUid, locale);
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
          {t.availableBefore}
          <b>{balance == null ? "—" : formatCredits(balance)}</b>
          {t.availableAfter}
          {t.loadedEntries(ledger.length)}
        </span>
      </div>
      <div className="account-table-card">
        <Table variant="secondary" className="account-table account-ledger-table">
          <Table.ScrollContainer>
            <Table.Content aria-label={t.entriesTable}>
              <Table.Header>
                <Table.Column className="account-col-time">{t.columns.time}</Table.Column>
                <Table.Column isRowHeader className="account-col-type">
                  {t.columns.type}
                </Table.Column>
                <Table.Column className="account-col-detail">{t.columns.detail}</Table.Column>
                <Table.Column className="account-col-member">{t.columns.member}</Table.Column>
                <Table.Column className="account-col-amount">{t.columns.change}</Table.Column>
              </Table.Header>
              <Table.Body
                items={visible}
                renderEmptyState={() => (
                  <p className="account-empty" role="status">
                    {entriesStatusText}
                  </p>
                )}
              >
                {(entry) => {
                  const optimizationName =
                    entry.kind === "consume" ? t.optimizationSpent : t.optimizationReturned;
                  const name = isPromptOptimization(entry)
                    ? optimizationName
                    : entryName(entry, locale);
                  return (
                    <Table.Row id={entry.id}>
                      <Table.Cell className="account-cell-time">
                        {recordTime(entry.created_at, locale)}
                      </Table.Cell>
                      <Table.Cell className="account-cell-type">
                        <span className="account-entry-type">
                          <EntryMark kind={entry.kind} />
                          {name}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="account-cell-detail">
                        {entryDetail(entry, locale)}
                      </Table.Cell>
                      <Table.Cell className="account-cell-member">
                        {memberLabel(entry.user_uid, currentUid, locale)}
                      </Table.Cell>
                      <Table.Cell
                        className={`account-cell-amount${entry.amount > 0 ? " is-positive" : ""}`}
                      >
                        {signedCredits(entry.amount)}
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
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
          <span>{t.shownEntries(visible.length, entries.hasNextPage)}</span>
          {entries.isError && (
            <Button size="sm" variant="secondary" onPress={() => void entries.refetch()}>
              {t.reloadEntries}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
