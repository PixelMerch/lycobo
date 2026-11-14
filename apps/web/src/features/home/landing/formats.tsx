import { Button } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { useMessages } from "../../../i18n/messages";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useRequireLogin } from "../../auth/login-prompt";
import { useSmartVariationDraft } from "../../commerce/smart-variation/smart-variation-state";
import { useStudioStore } from "../../generation/studio-state";
import { type CampaignFormat, campaignFormats, type FormatTool } from "./commerce-content";
import { sectionsMessages } from "./sections-messages";

/** 模板横滑的自动滚动速度，按像素每秒计算，保持缓慢移动。 */
const autoScrollSpeed = 26;

const pendingKey = "lycobo:commerce:template";
const pendingTtl = 30 * 60 * 1000;

const toolPaths: Record<FormatTool, string> = {
  create: "/commerce/create",
  variation: "/commerce/smart-variation",
  replica: "/commerce/replica",
  textile: "/commerce/textile-set",
};

/** 电商专区模板横滑：缓慢自动向左滚动，也可点击箭头切换。 */
export function Formats() {
  const remix = useTemplateRemix();
  const t = useMessages(sectionsMessages).formats;
  const { trackRef, carouselRef, sectionRef, scroll } = useFormatCarousel();
  return (
    <div>
      <section
        aria-labelledby="campaign-formats-title"
        className="lp-formats"
        id="formats"
        ref={sectionRef}
      >
        <section aria-label={t.carouselLabel}>
          <div className="lp-formatsHeading">
            <div className="lp-sectionHeading">
              <span className="cn-badge lp-formatEyebrow">{t.eyebrow}</span>
              <h2 id="campaign-formats-title">{t.title}</h2>
              <p>{t.description}</p>
            </div>
            <div className="lp-galleryControls">
              <Button isIconOnly aria-label={t.previous} onPress={() => scroll(-1)}>
                <IconChevronLeft size={14} />
              </Button>
              <Button isIconOnly aria-label={t.next} onPress={() => scroll(1)}>
                <IconChevronRight size={14} />
              </Button>
            </div>
          </div>

          <div className="lp-formatsCarousel" ref={carouselRef}>
            <div className="lp-formatsTrack" ref={trackRef}>
              <FormatSet onSelect={remix.select} />
              <div aria-hidden="true" className="lp-formatsSet" inert>
                <FormatSet duplicate onSelect={remix.select} />
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

function useFormatsMessages() {
  return useMessages(sectionsMessages).formats;
}

/** 打开工具的模板使用工具名，其余模板使用统一的创作动作。 */
function actionLabel(format: CampaignFormat, t: ReturnType<typeof useFormatsMessages>) {
  if (format.action === "use") return t.use;
  return format.tool === "replica" ? t.openReplica : t.openTextile;
}

function FormatSet({
  duplicate = false,
  onSelect,
}: {
  duplicate?: boolean;
  onSelect: (format: CampaignFormat) => void;
}) {
  const t = useMessages(sectionsMessages).formats;
  return (
    <>
      {campaignFormats.map((format) => {
        const copy = t.cards[format.id];
        const action = actionLabel(format, t);
        return (
          <div className="lp-formatItem" key={format.id}>
            <Button
              aria-hidden={duplicate || undefined}
              aria-label={
                format.action === "use" ? t.namedAction(copy.title) : `${action} ${copy.title}`
              }
              className="lp-formatCard"
              onPress={() => onSelect(format)}
            >
              <img alt={duplicate ? "" : copy.title} loading="lazy" src={format.image} />
              <span className="lp-formatBody">
                <span className="lp-templateTitle">{copy.title}</span>
                <span className="lp-formatMore">
                  <span className="lp-templateDescription">{copy.description}</span>
                  <span className="lp-formatCta">{action}</span>
                </span>
              </span>
            </Button>
          </div>
        );
      })}
    </>
  );
}

/** 未登录时记住本次模板，登录返回后继续同一次选择。 */
function rememberPending(format: CampaignFormat) {
  try {
    sessionStorage.setItem(pendingKey, JSON.stringify({ id: format.id, at: Date.now() }));
  } catch {
    // 隐私模式禁用存储时只保留登录门禁，不阻断流程。
  }
}

function takePending() {
  try {
    const raw = sessionStorage.getItem(pendingKey);
    if (!raw) return null;
    sessionStorage.removeItem(pendingKey);
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return null;
    if (!("id" in saved) || !("at" in saved)) return null;
    if (typeof saved.id !== "string" || typeof saved.at !== "number") return null;
    if (Date.now() - saved.at > pendingTtl) return null;
    return campaignFormats.find((format) => format.id === saved.id) ?? null;
  } catch {
    return null;
  }
}

/** 主图草稿已有内容且提示词不同，需要确认覆盖。 */
function createDraftConflict(prompt: string) {
  const { activeModel, drafts } = useStudioStore.getState();
  const draft = drafts[activeModel];
  const hasContent = Boolean(draft?.prompt.trim()) || (draft?.references.length ?? 0) > 0;
  return hasContent && draft?.prompt.trim() !== prompt.trim();
}

/** 套图草稿已有需求且内容不同，需要确认覆盖。 */
function variationDraftConflict(prompt: string) {
  const description = useSmartVariationDraft.getState().description.trim();
  return Boolean(description) && description !== prompt.trim();
}

/** 模板只把提示词与规格带入草稿；选择工具和登录门禁沿用现有工作区。 */
function useTemplateRemix() {
  const t = useMessages(sectionsMessages).formats;
  const session = useEnterpriseSession();
  const requireLogin = useRequireLogin();
  const navigate = useAppNavigate();
  const [pending, setPending] = useState<CampaignFormat | null>(null);

  const apply = useCallback(
    (format: CampaignFormat) => {
      const prompt = t.prompts[format.id];
      if (format.action === "use" && format.tool === "create") {
        const { activeModel, updateDraft } = useStudioStore.getState();
        updateDraft(activeModel, {
          prompt,
          ...(format.ratio ? { ratio: format.ratio } : {}),
        });
      }
      if (format.action === "use" && format.tool === "variation") {
        useSmartVariationDraft.getState().update({
          description: prompt,
          ...(format.ratio ? { ratio: format.ratio } : {}),
        });
      }
      setPending(null);
      void navigate(toolPaths[format.tool]);
    },
    [navigate, t.prompts],
  );

  const prepare = useCallback(
    (format: CampaignFormat) => {
      const prompt = t.prompts[format.id];
      const conflict =
        format.action === "use" &&
        ((format.tool === "create" && createDraftConflict(prompt)) ||
          (format.tool === "variation" && variationDraftConflict(prompt)));
      if (conflict) {
        setPending(format);
        return;
      }
      apply(format);
    },
    [apply, t.prompts],
  );

  useEffect(() => {
    if (!session.data) return;
    const saved = takePending();
    if (saved) prepare(saved);
  }, [session.data, prepare]);

  function select(format: CampaignFormat) {
    if (!requireLogin()) {
      rememberPending(format);
      return;
    }
    prepare(format);
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
