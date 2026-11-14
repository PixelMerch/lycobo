import { IconArrowUpRight } from "@tabler/icons-react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ImageSetFeature } from "./image-set-feature";
import { KitSpecs } from "./kit-specs";

/** 以构图参考介绍复制爆款的用途，并进入现有工具。 */
function SpecialistTools() {
  const t = useMessages(commerceShowcaseMessages).tools;
  const tools = [{ id: "replica", image: "p07-perfume-hero", path: "/commerce/replica" }] as const;
  return (
    <div className="commerce-section commerce-specialists">
      {tools.map((tool) => (
        <article className="commerce-specialist" key={tool.id}>
          <div className="commerce-specialist-image">
            <img src={`/landing/commerce/${tool.image}.webp`} alt={t[tool.id].alt} loading="lazy" />
          </div>
          <div>
            <h3>{t[tool.id].title}</h3>
            <p>{t[tool.id].description}</p>
            <RouteLink to={tool.path} className="commerce-text-link">
              {t[tool.id].action}
              <UiIcon icon={IconArrowUpRight} />
            </RouteLink>
          </div>
        </article>
      ))}
    </div>
  );
}

/** 以套图、专用工具与可操作的输出规格介绍完整图片制作能力。 */
export function Workflow() {
  const t = useMessages(commerceShowcaseMessages).specs;
  return (
    <>
      <ImageSetFeature />
      <SpecialistTools />
      <section className="commerce-section commerce-output" aria-labelledby="commerce-output-title">
        <div className="commerce-section-heading">
          <div>
            <h2 id="commerce-output-title">{t.title}</h2>
          </div>
          <p className="commerce-description">{t.description}</p>
        </div>
        <KitSpecs />
      </section>
    </>
  );
}
