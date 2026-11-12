import { Button } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useRef } from "react";
import { campaignFormats } from "./content";

/** 复刻页模板横滑：点击把模板描述写进首屏输入框，暂不生成真实广告。 */
export function Formats() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    if (direction < 0 && track.scrollLeft < 8) {
      track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
      return;
    }
    if (direction > 0 && track.scrollLeft + track.clientWidth >= track.scrollWidth - 8) {
      track.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    track.scrollBy({ left: direction * 292, behavior: "smooth" });
  };

  return (
    <div>
      <section aria-labelledby="campaign-formats-title" className="vm-formats" id="formats">
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

          <div className="vm-formatsCarousel">
            <div className="vm-formatsTrack" ref={trackRef}>
              <FormatSet />
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
