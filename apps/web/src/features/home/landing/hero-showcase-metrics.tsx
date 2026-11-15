import { Button, Popover } from "@heroui/react";
import { IconArrowUp, IconReceipt } from "@tabler/icons-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import type { Example } from "./hero-showcase-data";
import { showcaseMessages } from "./hero-showcase-messages";

/** 用 Motion 推进数值，提前留出最终数值的宽度。 */
function MetricCounter({
  before,
  after,
  format,
  ready,
}: {
  before: number;
  after: number;
  format: Intl.NumberFormat;
  ready: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const value = useMotionValue(before);
  const display = useTransform(() => format.format(Math.round(value.get())));

  useEffect(() => {
    if (!ready || reduceMotion) return;
    const playback = animate(value, after, {
      delay: 1.5,
      duration: 0.8,
      ease: "easeOut",
    });
    return () => playback.stop();
  }, [after, ready, reduceMotion, value]);

  return (
    <strong aria-hidden="true" className="lp-metricCounter">
      <span className="lp-metricFinal">{format.format(after)}</span>
      <motion.span className="lp-metricAnimated">{display}</motion.span>
    </strong>
  );
}

/** 以不同版式展示每个平台的演示指标，并提供同口径的前后对照。 */
export function ShowcaseMetrics({
  example,
  onInspect,
  ready,
}: {
  example: Example;
  onInspect: (open: boolean) => void;
  ready: boolean;
}) {
  const t = useMessages(showcaseMessages);
  const locale = useLocale();
  const { metric, values, visits } = example;
  const [before, after] = values;
  const number = new Intl.NumberFormat(locale);
  const format =
    metric === "sales"
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : number;
  const change = new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "always",
    maximumFractionDigits: 2,
  }).format((after - before) / before);
  const label = t.metrics[metric];

  return (
    <div className="lp-metricStack">
      <Popover onOpenChange={onInspect}>
        <Button
          aria-label={`${label} ${format.format(after)} · ${t.demoData}`}
          className="lp-storeSales"
          data-metric={metric}
          variant="tertiary"
        >
          {metric === "orders" && (
            <span className="lp-metricIcon">
              <UiIcon icon={IconReceipt} size="navigation" />
            </span>
          )}
          <span className="lp-metricBody">
            <span className="lp-metricLabel">{label}</span>
            <span className="lp-metricValue">
              <MetricCounter before={before} after={after} format={format} ready={ready} />
              <span className="lp-metricChange">
                <UiIcon icon={IconArrowUp} size="small" />
                {change}
              </span>
            </span>
            {metric === "views" && (
              <span aria-hidden="true" className="lp-metricBars">
                <i style={{ height: `${(before / after) * 100}%` }} />
                <i />
              </span>
            )}
            {metric === "carts" && (
              <span className="lp-metricBefore">
                {t.before} · {format.format(before)}
              </span>
            )}
          </span>
        </Button>
        <Popover.Content className="lp-storeSalesPopover" placement="bottom end">
          <Popover.Dialog aria-label={t.viewMetrics}>
            <table>
              <caption>{t.period}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.metric}</th>
                  <th scope="col">{t.before}</th>
                  <th scope="col">{t.after}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{label}</th>
                  <td>{format.format(before)}</td>
                  <td>{format.format(after)}</td>
                </tr>
                <tr>
                  <th scope="row">{t.visits}</th>
                  <td>{number.format(visits[0])}</td>
                  <td>{number.format(visits[1])}</td>
                </tr>
              </tbody>
            </table>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}
