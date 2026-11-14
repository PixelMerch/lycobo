import { Button } from "@heroui/react";
import { IconArrowRight, IconArrowUpRight } from "@tabler/icons-react";
import { lazy, Suspense, useState } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { casesMessages } from "./cases-messages";
import { caseCards } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { KitSpecs } from "./kit-specs";

const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 展示同款服装的整体与细节，按需打开已有全屏图片浏览器。 */
function ImageSetFeature() {
  const t = useMessages(commerceShowcaseMessages).set;
  const cases = useMessages(casesMessages);
  const [open, setOpen] = useState(false);
  const jacket = caseCards.find((card) => card.id === "jacket");
  const images = [
    { src: "/landing/commerce/p11-worn.webp", alt: cases.cards.jacket.alt },
    ...(jacket?.details ?? []).map((detail) => ({
      src: detail.image,
      alt: cases.detailAlt[detail.id],
    })),
    { src: "/landing/commerce/p11-jacket-mother.webp", alt: cases.referenceAlt },
  ];
  return (
    <section className="commerce-section commerce-set" aria-labelledby="commerce-set-title">
      <div className="commerce-feature-copy">
        <h2 id="commerce-set-title">{t.title}</h2>
        <p className="commerce-description">{t.description}</p>
        <ol className="commerce-steps">
          {t.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <RouteLink to="/commerce/smart-variation" className="commerce-text-link">
          {t.action}
          <UiIcon icon={IconArrowRight} />
        </RouteLink>
      </div>
      <div className="commerce-set-reveal">
        <Button
          variant="ghost"
          className="commerce-set-visual"
          aria-label={t.open}
          onPress={() => setOpen(true)}
        >
          <span className="commerce-set-main">
            <img src="/landing/commerce/p11-worn.webp" alt={t.alt} loading="lazy" />
            <span>{t.full}</span>
          </span>
          <span className="commerce-set-detail">
            <img src="/landing/commerce/p11-zipper.webp" alt="" loading="lazy" />
            <span>{t.zipper}</span>
          </span>
          <span className="commerce-set-detail">
            <img src="/landing/commerce/p11-fabric.webp" alt="" loading="lazy" />
            <span>{t.fabric}</span>
          </span>
          <span className="commerce-set-scene">
            <img src="/landing/commerce/p11-scene.webp" alt="" loading="lazy" />
            <span>
              {t.scene}
              <UiIcon icon={IconArrowUpRight} />
            </span>
          </span>
        </Button>
      </div>
      {open && (
        <Suspense fallback={null}>
          <ImageViewer images={images} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}

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
