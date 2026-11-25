import { creditOfferEnd } from "@lycoboai/contracts";
import { useEffect, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { creditsMessages } from "./credits-messages";

/** 使用全站固定的活动截止时间，活动到期后恢复常规积分与价格。 */
export function useCreditOffer(serverEnd?: string) {
  const offerEnd = Date.parse(creditOfferEnd(serverEnd));
  const [now, setNow] = useState(Date.now);
  const seconds = Math.max(0, Math.ceil((offerEnd - now) / 1000));
  const isActive = seconds > 0;
  useEffect(() => {
    if (!isActive) return;
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, [isActive]);
  return { includeOffer: isActive, seconds };
}

/** 在充值弹框展示活动倒计时。 */
export function CreditOffer({ seconds }: { seconds: number }) {
  const t = useMessages(creditsMessages);
  const parts = [
    Math.floor(seconds / 86400),
    Math.floor((seconds % 86400) / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ];
  return (
    <div className="credit-offer">
      <div>
        <strong>{t.offerTitle}</strong>
        <p>{t.offerEndsIn}</p>
      </div>
      <div className="credit-offer-countdown" role="timer" aria-label={t.offerEndsIn}>
        {t.offerTimeUnits.map((unit, index) => (
          <span key={unit}>
            <b>{String(parts[index]).padStart(2, "0")}</b>
            {unit}
          </span>
        ))}
      </div>
    </div>
  );
}
