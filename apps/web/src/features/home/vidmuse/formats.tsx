import { Button } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { campaignFormats } from "./content";

/** 模板横滑的自动滚动速度，按像素每秒计算，保持缓慢移动。 */
const autoScrollSpeed = 26;

/** 复刻页模板横滑：缓慢自动向左滚动，也可点击箭头切换；暂不生成真实广告。 */
export function Formats() {
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

  return (
    <div>
      <section
        aria-labelledby="campaign-formats-title"
        className="vm-formats"
        id="formats"
        ref={sectionRef}
      >
        <section aria-label="Campaign creative formats">
          <div className="vm-formatsHeading">
            <div className="vm-sectionHeading">
              <span className="cn-badge vm-formatEyebrow">Proven formats, ready to remix</span>
              <h2 id="campaign-formats-title">Product in, ads out</h2>
              <p>Choose a proven format. VidMuse rebuilds it around your product in minutes.</p>
            </div>
            <div className="vm-galleryControls">
              <Button isIconOnly aria-label="Previous campaign format" onPress={() => scroll(-1)}>
                <IconChevronLeft size={14} />
              </Button>
              <Button isIconOnly aria-label="Next campaign format" onPress={() => scroll(1)}>
                <IconChevronRight size={14} />
              </Button>
            </div>
          </div>

          <div className="vm-formatsCarousel" ref={carouselRef}>
            <div className="vm-formatsTrack" ref={trackRef}>
              <FormatSet />
              <div className="vm-formatsSet" inert>
                <FormatSet duplicate />
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

function FormatSet({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <>
      {campaignFormats.map((format) => (
        <div className="vm-formatItem" key={`${format.title}-${String(duplicate)}`}>
          <Button
            aria-hidden={duplicate || undefined}
            aria-label={`Remix ${format.title}`}
            className="vm-formatCard"
            onPress={() =>
              window.dispatchEvent(
                new CustomEvent("vm:remix", {
                  detail: { title: format.title, description: format.description },
                }),
              )
            }
          >
            <img alt="" src={format.image} />
            <span className="vm-formatBody">
              <span className="vm-templateTitle">{format.title}</span>
              <span className="vm-formatMore">
                <span className="vm-templateDescription">{format.description}</span>
                <span className="vm-formatCta">Remix</span>
              </span>
            </span>
          </Button>
        </div>
      ))}
    </>
  );
}
