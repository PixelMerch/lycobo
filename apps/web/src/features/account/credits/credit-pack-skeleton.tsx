import { Skeleton } from "@heroui/react";
import { creditPacks } from "@lycoboai/contracts";
import { useMessages } from "../../../i18n/messages";
import { creditsMessages } from "./credits-messages";

/** 充值档位和活动价格首次读取时，保留现有卡片网格的尺寸。 */
export function CreditPackSkeleton() {
  const t = useMessages(creditsMessages);
  return (
    <div role="status" aria-label={t.loadingPacks}>
      <ul className="credit-pack-grid" aria-hidden="true">
        {creditPacks.map(({ id }) => (
          <li key={id} className="credit-pack">
            <div className="credit-pack-surface credit-pack-skeleton">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-auto h-11 w-full rounded-lg" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
