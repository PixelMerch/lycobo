import { Button, Disclosure, Pagination } from "@heroui/react";
import { IconChevronRight } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import type { Locale } from "../../../i18n/locale";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useEnterpriseSession } from "../../auth/auth-client";
import {
  entryDetail,
  formatCredits,
  memberLabel,
  usageAmount,
  usageTime,
  usageTitle,
  type WalletEntry,
} from "../account-format";
import { creditsMessages } from "./credits-messages";
import { type CreditUsage, pageWindow, type UsageView, useCreditUsage } from "./use-credit-usage";

/** 当前视图的一页收支与分页；加载、失败和空状态如实说明，读取失败不显示成“没有记录”。 */
export function CreditUsageList({ view }: { view: UsageView }) {
  const usage = useCreditUsage(view);
  const session = useEnterpriseSession();
  return (
    <>
      {usage.rows.length > 0 ? (
        <div className="credit-usage-list">
          {usage.rows.map((entry) => (
            <UsageRow key={entry.id} entry={entry} currentUid={session.data?.uid} />
          ))}
        </div>
      ) : (
        <UsageStatus view={view} usage={usage} />
      )}
      {(usage.rows.length > 0 || usage.page > 1) && <UsagePagination usage={usage} />}
    </>
  );
}

function UsageStatus({ view, usage }: { view: UsageView; usage: CreditUsage }) {
  const t = useMessages(creditsMessages);
  if (usage.isLoading)
    return (
      <p className="credit-usage-status" role="status">
        {t.loadingRecords}
      </p>
    );
  if (usage.isError)
    return (
      <div className="credit-usage-status" role="status">
        <p>{t.recordsUnavailable}</p>
        <Button size="sm" variant="secondary" onPress={usage.retry}>
          {t.reload}
        </Button>
      </div>
    );
  if (usage.canLoadOlder)
    return (
      <div className="credit-usage-status" role="status">
        <p>{t.noRecentRecords[view]}</p>
        <Button size="sm" variant="secondary" onPress={usage.loadOlder}>
          {t.showOlder}
        </Button>
      </div>
    );
  return (
    <p className="credit-usage-status" role="status">
      {t.noRecords[view]}
    </p>
  );
}

/** 展开后的说明行：任务或充值订单、操作成员和变动后结余，都来自真实收支记录。 */
function usageDetails(entry: WalletEntry, currentUid: string | undefined, locale: Locale) {
  const labels = creditsMessages[locale].detailLabels;
  const detail = entryDetail(entry, locale);
  const lines = [
    { label: labels.member, value: memberLabel(entry.user_uid, currentUid, locale) },
    { label: labels.balanceAfter, value: formatCredits(entry.balance_after) },
  ];
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

function UsagePagination({ usage }: { usage: CreditUsage }) {
  const t = useMessages(creditsMessages);
  return (
    <Pagination className="credit-usage-pagination" aria-label={t.pages}>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            aria-label={t.previousPage}
            isDisabled={usage.page <= 1}
            onPress={() => usage.goTo(usage.page - 1)}
          >
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {pageWindow(usage.page, usage.pageCount).map((item) =>
          typeof item === "string" ? (
            <Pagination.Item key={item}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={item}>
              <Pagination.Link
                aria-label={t.page(item)}
                isActive={item === usage.page}
                onPress={() => usage.goTo(item)}
              >
                {item}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next
            aria-label={t.nextPage}
            isDisabled={!usage.canNext}
            onPress={() => usage.goTo(usage.page + 1)}
          >
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
