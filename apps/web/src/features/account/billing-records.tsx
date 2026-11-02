import { IconReceipt } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";

export interface BillingRecord {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
  amount: string;
  balance: string;
  positive: boolean;
}

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Group the loaded records only; no inferred totals from incomplete pagination. */
export function BillingRecords({
  records,
  label,
  emptyMessage,
}: {
  records: BillingRecord[];
  label: string;
  emptyMessage: string;
}) {
  const groups = new Map<string, BillingRecord[]>();
  for (const record of records) {
    const date = dateFormat.format(new Date(record.createdAt));
    const group = groups.get(date) ?? [];
    group.push(record);
    groups.set(date, group);
  }
  if (records.length === 0)
    return (
      <div className="billing-empty" role="status">
        <span className="billing-empty-icon">
          <UiIcon icon={IconReceipt} size="illustration" />
        </span>
        <p>{emptyMessage}</p>
      </div>
    );
  return (
    <section className="billing-records" aria-label={label}>
      {Array.from(groups, ([date, items]) => (
        <section className="billing-day" key={date} aria-label={date}>
          <h3>{date}</h3>
          <ul aria-label={`${date} ${label}`}>
            {items.map((record) => (
              <li className="billing-record" key={record.id}>
                <span
                  className={`billing-record-mark${record.positive ? " billing-record-mark--positive" : ""}`}
                  aria-hidden="true"
                >
                  <UiIcon icon={IconReceipt} />
                </span>
                <div className="billing-record-detail">
                  <div className="billing-record-title">
                    <strong>{record.title}</strong>
                    <time dateTime={record.createdAt}>
                      {timeFormat.format(new Date(record.createdAt))}
                    </time>
                  </div>
                  <p>{record.detail}</p>
                </div>
                <div className="billing-record-amount">
                  <strong className={record.positive ? "account-amount-positive" : undefined}>
                    {record.amount}
                  </strong>
                  <span>{record.balance}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
