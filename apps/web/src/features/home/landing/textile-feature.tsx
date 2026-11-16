import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ImageSetFeature } from "./image-set-feature";
import { useShowcaseScroll } from "./use-showcase-scroll";

/** 家纺与服装随页面滚动自动衔接，向上回滚可重看上一套商品。 */
export function TextileFeature() {
  const t = useMessages(commerceShowcaseMessages).set;
  const chapter = useShowcaseScroll(2);
  const apparel = chapter.active === 1;
  return (
    <section
      ref={chapter.section}
      className="commerce-sets-story commerce-scroll-story"
      data-family={apparel ? "apparel" : "textile"}
      aria-labelledby="commerce-set-title"
    >
      <div className="commerce-story-sticky">
        <div className="commerce-section">
          <div className="commerce-set-header">
            <h2 id="commerce-set-title">{t.title}</h2>
            <ToggleButtonGroup
              className="commerce-family-tabs"
              aria-label={t.choose}
              isDetached
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[String(chapter.active)]}
              onSelectionChange={(keys) => {
                const [key] = keys;
                if (key === "0" || key === "1") chapter.select(Number(key));
              }}
            >
              <ToggleButton id="0">{t.textile}</ToggleButton>
              <ToggleButton id="1">{t.apparel}</ToggleButton>
            </ToggleButtonGroup>
          </div>
          <ImageSetFeature apparel={apparel} />
        </div>
      </div>
    </section>
  );
}
