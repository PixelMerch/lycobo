import { Button } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { useMessages } from "../../../i18n/messages";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";
import { useRequireLogin } from "../../auth/login-prompt";
import { useStudioStore } from "../../generation/studio-state";
import { homeInspirationMessages } from "../home-inspiration-messages";
import { type CampaignFormat, campaignFormats } from "./content";

/** 模板横滑的自动滚动速度，按像素每秒计算，保持缓慢移动。 */
const autoScrollSpeed = 26;

/** 复刻页模板横滑：缓慢自动向左滚动，也可点击箭头切换；暂不生成真实广告。 */
export function Formats() {
  const remix = useTemplateRemix();
  const { trackRef, carouselRef, sectionRef, scroll } = useFormatCarousel();
  return (
    <div>
      <section
        aria-labelledby="campaign-formats-title"
        className="lp-formats"
        id="formats"
        ref={sectionRef}
      >
        <section aria-label="Campaign creative formats">
          <div className="lp-formatsHeading">
            <div className="lp-sectionHeading">
              <span className="cn-badge lp-formatEyebrow">Proven formats, ready to remix</span>
              <h2 id="campaign-formats-title">Product in, ads out</h2>
              <p>Choose a proven format. Rebuild it around your product in minutes.</p>
            </div>
            <div className="lp-galleryControls">
              <Button isIconOnly aria-label="Previous campaign format" onPress={() => scroll(-1)}>
                <IconChevronLeft size={14} />
              </Button>
              <Button isIconOnly aria-label="Next campaign format" onPress={() => scroll(1)}>
                <IconChevronRight size={14} />
              </Button>
            </div>
          </div>

          <div className="lp-formatsCarousel" ref={carouselRef}>
            <div className="lp-formatsTrack" ref={trackRef}>
              <FormatSet onRemix={remix.select} />
              <div className="lp-formatsSet" inert>
                <FormatSet duplicate onRemix={remix.select} />
              </div>
            </div>
          </div>
        </section>
      </section>
      {remix.dialog}
    </div>
  );
}

function useFormatCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const resumeAtRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    const carousel = carouselRef.current;
    const section = sectionRef.current;
    if (!track || !carousel || !section) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let previous = performance.now();
    let paused = false;
    let visible = false;

    const visibility = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    });
    visibility.observe(carousel);

    const tick = (now: number) => {
      const elapsed = Math.min(64, now - previous);
      previous = now;
      const manualPause = now < resumeAtRef.current;
      if (!paused && !manualPause && visible && !document.hidden) {
        const half = track.scrollWidth / 2;
        if (half > track.clientWidth) {
          const next = track.scrollLeft + (elapsed * autoScrollSpeed) / 1000;
          track.scrollLeft = next >= half ? next - half : next;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
    };
    const resumeAfterFocus = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !section.contains(event.relatedTarget)) {
        paused = false;
      }
    };

    section.addEventListener("focusin", pause);
    section.addEventListener("focusout", resumeAfterFocus);
    carousel.addEventListener("pointerenter", pause);
    carousel.addEventListener("pointerleave", resume);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      section.removeEventListener("focusin", pause);
      section.removeEventListener("focusout", resumeAfterFocus);
      carousel.removeEventListener("pointerenter", pause);
      carousel.removeEventListener("pointerleave", resume);
    };
  }, []);

  const scroll = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    resumeAtRef.current = performance.now() + 800;
    if (direction < 0 && track.scrollLeft < 8) {
      track.scrollTo({ left: track.scrollWidth });
      return;
    }
    if (direction > 0 && track.scrollLeft + track.clientWidth >= track.scrollWidth - 8) {
      track.scrollTo({ left: 0 });
      return;
    }
    const card = track.firstElementChild;
    const step = card?.getBoundingClientRect().width ?? 292;
    track.scrollBy({ left: direction * step });
  };

  return { trackRef, carouselRef, sectionRef, scroll };
}

function FormatSet({
  duplicate = false,
  onRemix,
}: {
  duplicate?: boolean;
  onRemix: (format: CampaignFormat) => void;
}) {
  return (
    <>
      {campaignFormats.map((format) => (
        <div className="lp-formatItem" key={`${format.title}-${String(duplicate)}`}>
          <Button
            aria-hidden={duplicate || undefined}
            aria-label={`Remix ${format.title}`}
            className="lp-formatCard"
            onPress={() => onRemix(format)}
          >
            <img alt="" src={format.image} />
            <span className="lp-formatBody">
              <span className="lp-templateTitle">{format.title}</span>
              <span className="lp-formatMore">
                <span className="lp-templateDescription">{format.description}</span>
                <span className="lp-formatCta">Remix</span>
              </span>
            </span>
          </Button>
        </div>
      ))}
    </>
  );
}

/** 选用模板时进入主图工作区，替换已有提示词前先确认。 */
function useTemplateRemix() {
  const requireLogin = useRequireLogin();
  const navigate = useAppNavigate();
  const t = useMessages(homeInspirationMessages);
  const [pending, setPending] = useState<CampaignFormat | null>(null);

  function apply(format: CampaignFormat) {
    const { activeModel, updateDraft } = useStudioStore.getState();
    updateDraft(activeModel, { prompt: format.description });
    setPending(null);
    void navigate("/commerce/create");
  }

  function select(format: CampaignFormat) {
    if (!requireLogin()) return;
    const { activeModel, drafts } = useStudioStore.getState();
    const existing = drafts[activeModel]?.prompt.trim();
    if (existing && existing !== format.description) setPending(format);
    else apply(format);
  }

  const dialog = (
    <ConfirmDialog
      isOpen={pending !== null}
      title={t.replaceTitle}
      content={t.replaceContent}
      confirmLabel={t.replaceConfirm}
      cancelLabel={t.keepCurrent}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        if (pending) apply(pending);
      }}
    />
  );
  return { select, dialog };
}
