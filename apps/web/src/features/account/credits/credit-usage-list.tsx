import { Button, Disclosure } from "@heroui/react";
import { IconChevronRight } from "@tabler/icons-react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { UiIcon } from "../../../components/ui-icon";
import type { Locale } from "../../../i18n/locale";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useEnterpriseSession } from "../../auth/auth-client";
import {
  entryDetail,
  memberLabel,
  usageAmount,
  usageTime,
  usageTitle,
  type WalletEntry,
} from "../account-format";
import { useWalletEntries, type WalletEntryView } from "../wallet-client";
import { creditsMessages } from "./credits-messages";

/** 在弹窗内部连续滚动收支，续读失败时保留已加载记录并支持重试。 */
export function CreditUsageList({ view }: { view: WalletEntryView }) {
  const entries = useWalletEntries(20, view);
  const session = useEnterpriseSession();
  const t = useMessages(creditsMessages);
  const rows = entries.data?.pages.flatMap((page) => page.data) ?? [];
  const loadMore = () => entries.fetchNextPage({ cancelRefetch: false });
  const retry = () => {
    if (entries.isFetchNextPageError) void loadMore();
    else void entries.refetch();
  };
  let status: string | undefined;
  if (entries.isPending) status = t.loadingRecords;
  else if (entries.isError) status = t.recordsUnavailable;
  else if (!rows.length) status = t.noRecords[view];
  return (
    <div className="credit-usage-list">
      {rows.map((entry) => (
        <UsageRow key={entry.id} entry={entry} currentUid={session.data?.uid} />
      ))}
      {status && (
        <div className="credit-usage-status" role="status">
          <p>{status}</p>
          {entries.isError && (
            <Button size="sm" variant="secondary" onPress={retry}>
              {t.reload}
            </Button>
          )}
        </div>
      )}
      <InfiniteLoad
        hasMore={entries.hasNextPage && !entries.isRefetching}
        isLoading={entries.isFetchingNextPage}
        isError={entries.isError}
        onLoadMore={loadMore}
      />
    </div>
  );
}

/** 展开后显示任务或充值订单和操作成员。 */
function usageDetails(entry: WalletEntry, currentUid: string | undefined, locale: Locale) {
  const labels = creditsMessages[locale].detailLabels;
  const detail = entryDetail(entry, locale);
  const lines = [{ label: labels.member, value: memberLabel(entry.user_uid, currentUid, locale) }];
  if (detail !== "—" && detail !== usageTitle(entry, locale))
    lines.unshift({ label: labels.detail, value: detail });
  return lines;
}

function UsageRow({ entry, currentUid }: { entry: WalletEntry; currentUid: string | undefined }) {
  const locale = useLocale();
  return (
    <Disclosure className="credit-usage-row">
      <Disclosure.Heading className="credit-usage-heading">
        <Disclosure.Trigger className="credit-usage-trigger">
          <UiIcon icon={IconChevronRight} size="small" className="credit-usage-chevron" />
          <span className="credit-usage-main">
            <span className="credit-usage-name">{usageTitle(entry, locale)}</span>
            <span className="credit-usage-time">{usageTime(entry.created_at)}</span>
          </span>
          <span className="credit-usage-amount" data-positive={entry.amount > 0 || undefined}>
            {usageAmount(entry.amount)}
          </span>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="credit-usage-body">
          <dl className="credit-usage-details">
            {usageDetails(entry, currentUid, locale).map((line) => (
              <div key={line.label} className="credit-usage-detail">
                <dt>{line.label}</dt>
                <dd>{line.value}</dd>
              </div>
            ))}
          </dl>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
