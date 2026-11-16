import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame } from "./product-frame";

const views = ["original", "studio", "detail"] as const;

/** 在 Hero 后用同款商品建立原图、主图与特写的关系。 */
export function ProductIntro() {
  const { intro, shots } = useMessages(commerceShowcaseMessages);

  return (
    <section className="commerce-intro" aria-labelledby="commerce-intro-title">
      <div className="commerce-section">
        <div className="commerce-intro-copy">
          <h2 id="commerce-intro-title">{intro.title}</h2>
          <p>{intro.description}</p>
        </div>
        <div className="commerce-intro-spread">
          {views.map((view) => (
            <figure key={view} data-view={view}>
              <ProductFrame view={view} />
              <figcaption>{shots[view]}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
