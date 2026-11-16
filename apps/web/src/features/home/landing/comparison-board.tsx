import { IconArrowRight } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { SceneDemo } from "./scene-demo";

/** 并列展示同一商品的参考原图与生成成片，突出主次画幅比例差异。 */
export function ComparisonBoard({
  example,
  alt,
}: {
  example: { id: string; reference: string; result: string };
  alt: string;
}) {
  const t = useMessages(commerceShowcaseMessages);
  return (
    <div className="commerce-comparison-board" data-case={example.id}>
      <figure className="commerce-comparison-original">
        <div className="commerce-comparison-frame">
          <img
            src={`/landing/commerce/${example.reference}.webp`}
            alt={`${t.reference} · ${alt}`}
            loading="lazy"
          />
        </div>
        <figcaption>{t.reference}</figcaption>
      </figure>
      <span className="commerce-comparison-direction" aria-hidden="true">
        <UiIcon icon={IconArrowRight} size="action" />
      </span>
      <figure className="commerce-comparison-finished">
        <div className="commerce-comparison-frame">
          {example.id === "scene" ? (
            <SceneDemo alt={`${t.result} · ${alt}`} />
          ) : (
            <img
              src={`/landing/commerce/${example.result}.webp`}
              alt={`${t.result} · ${alt}`}
              loading="lazy"
            />
          )}
        </div>
        <figcaption>{t.result}</figcaption>
      </figure>
    </div>
  );
}
