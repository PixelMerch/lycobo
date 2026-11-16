import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { SceneDemo } from "./scene-demo";

/** 将同一商品的原图贴在成片旁，保留完整成片以便比较。 */
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
      <div className="commerce-comparison-pair">
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
    </div>
  );
}
