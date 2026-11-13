import { ToggleButton } from "@heroui/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useHeroPlayback } from "./use-hero-playback";

const examples = [
  {
    id: "skincare",
    video: "/landing/skincare.mp4",
    poster: "/landing/skincare.jpg",
    label: "Beauty creator holding a skincare serum",
    rail: ["12.8k", "186", "942"],
    stats: ["Increase Sales"],
  },
  {
    id: "fashion",
    video: "/landing/fashion.mp4",
    poster: "/landing/fashion.jpg",
    label: "Fashion creator in a yellow suit",
    rail: ["24.6k", "328", "1.6k"],
    stats: ["3.8k live watching"],
  },
  {
    id: "collectible",
    video: "/landing/collectible.mp4",
    poster: "/landing/collectible.jpg",
    label: "Pastel collectible character",
    rail: ["18.3k", "264", "1.2k"],
    stats: ["$6.2k"],
  },
] as const;

function SocialAuthor() {
  return (
    <div className="lp-socialAuthor">
      <span className="lp-authorAvatar">
        <img alt="" src="/landing/avatar-base.svg" />
        <span className="lp-authorAvatarMark">
          <img alt="" src="/landing/avatar-mark.svg" />
        </span>
        <img alt="" src="/landing/avatar-ring.svg" />
      </span>
      <span>
        <span className="lp-authorName">
          Lycobo
          <span className="lp-verified">
            <img alt="" src="/landing/verified.svg" />
          </span>
        </span>
        <small>Sponsored</small>
      </span>
    </div>
  );
}

function SocialRail({ counts }: { counts: readonly string[] }) {
  return (
    <div className="lp-socialRail">
      <span>
        <i>
          <img alt="" src="/landing/heart.svg" />
        </i>
        {counts[0]}
      </span>
      <span>
        <i>
          <img alt="" src="/landing/comment.svg" />
        </i>
        {counts[1]}
      </span>
      <span>
        <i>
          <img alt="" src="/landing/share.svg" />
        </i>
        {counts[2]}
      </span>
      <span>
        <i>
          <img alt="" src="/landing/more.svg" />
        </i>
      </span>
    </div>
  );
}

function FunnelCard() {
  return (
    <div className="lp-funnel">
      <strong>Funnel Conversion</strong>
      <div className="lp-funnelPanel">
        <div className="lp-funnelHead">
          <span>Conversion</span>
          <span>Added to cart</span>
        </div>
        <div className="lp-funnelNumbers">
          <span>
            <b>86%</b>
            <em>
              <i>
                <img alt="" src="/landing/up-arrow.svg" />
              </i>
              9%
            </em>
            <small>Last 4 weeks</small>
          </span>
          <span>
            <b>79%</b>
            <em>
              <i>
                <img alt="" src="/landing/up-arrow.svg" />
              </i>
              6%
            </em>
            <small>Last 4 weeks</small>
          </span>
        </div>
        <div className="lp-funnelCharts">
          <i>
            <img alt="" src="/landing/chart-blue.svg" />
          </i>
          <i>
            <img alt="" src="/landing/chart-purple.svg" />
          </i>
        </div>
      </div>
    </div>
  );
}

function EngagementCard() {
  return (
    <div className="lp-engagement">
      <span>Engagement</span>
      <strong>+48%</strong>
      <i>
        <img alt="" src="/landing/eng-arrow.svg" />
      </i>
    </div>
  );
}

function SalesPill() {
  return (
    <div className="lp-salesPill">
      <i>
        <img alt="" src="/landing/check-circle.svg" />
      </i>
      Increase Sales
    </div>
  );
}

function RoasCard() {
  return (
    <div className="lp-roas">
      <small>
        <i>
          <img alt="" src="/landing/up-arrow.svg" />
        </i>
        ROAS
      </small>
      <strong>4.2X</strong>
      <span>Higher return on ad spend</span>
    </div>
  );
}

function TimeSavedCard({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const [fill, setFill] = useState(0);

  useEffect(() => {
    if (!active || reducedMotion) {
      setFill(0);
      return;
    }
    let frame = 0;
    let timer = 0;
    const duration = 1500;
    // 慢起、中段加速、慢收尾，完成一整圈顺时针播放。
    const easeInOutCubic = (value: number) =>
      value < 0.5 ? 4 * value * value * value : 1 - (-2 * value + 2) ** 3 / 2;

    timer = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min(1, (now - start) / duration);
        setFill(easeInOutCubic(elapsed));
        if (elapsed < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, 120);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [active, reducedMotion]);

  const displayedFill = reducedMotion ? 1 : fill;
  const progress = Math.round(displayedFill * 97);
  const radius = 28.3262;
  const circumference = 2 * Math.PI * radius;
  // 与参考图一致：停在 97% 时保留顶部一小段装饰缺口。
  const ringRatio = displayedFill * 0.97 * 0.91;
  const startAngle = -79.2;
  const startRad = (startAngle * Math.PI) / 180;
  const startX = 33.5 + radius * Math.cos(startRad);
  const startY = 33.5 + radius * Math.sin(startRad);

  return (
    <div className="lp-timeSaved">
      <i>
        <svg aria-hidden="true" className="lp-productionRing" viewBox="0 0 67 67">
          <circle
            cx="33.5"
            cy="33.5"
            fill="none"
            r={radius}
            stroke="#0F1214"
            strokeOpacity="0.2"
            strokeWidth="10.3476"
          />
          <circle
            cx="33.5"
            cy="33.5"
            fill="none"
            r={radius}
            stroke="#FFE7CC"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ringRatio)}
            strokeLinecap="round"
            strokeWidth="10.3476"
            transform={`rotate(${startAngle} 33.5 33.5)`}
          />
          <circle cx={startX} cy={startY} fill="#FFE7CC" r="5.1738" />
        </svg>
        <b>{progress}%</b>
      </i>
      <span>
        Production time
        <small>Less production time</small>
      </span>
    </div>
  );
}

function LivePill() {
  return (
    <div className="lp-livePill">
      <i>
        <img alt="" src="/landing/live-circle.svg" />
      </i>
      3.8k live watching
    </div>
  );
}

function PostCard({ liked, onLike }: { liked: boolean; onLike: () => void }) {
  return (
    <div className="lp-post">
      <div>
        <img alt="Creator holding the collectible character" src="/landing/post-pic.webp" />
      </div>
      <span>
        <ToggleButton
          aria-label="Like campaign example"
          className="lp-postLike"
          isSelected={liked}
          onChange={onLike}
        >
          <i>
            <img alt="" src="/landing/ig-heart.svg" />
          </i>
        </ToggleButton>
        <i>
          <img alt="" src="/landing/ig-comment.svg" />
        </i>
        <i>
          <img alt="" src="/landing/ig-share.svg" />
        </i>
      </span>
    </div>
  );
}

function RatingPill() {
  return (
    <div className="lp-rating">
      <img alt="Five star campaign rating" src="/landing/bubble.svg" />
    </div>
  );
}

function TotalSales() {
  return (
    <div className="lp-totalSales">
      Total Sales
      <strong>$6.2k</strong>
    </div>
  );
}

/** 首屏右侧三组社媒广告示例轮播与浮层数据。 */
export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const { stageRef, playing } = useHeroPlayback(active, reducedMotion);

  const selectExample = (index: number) => {
    setActive(index);
    setLiked(false);
  };

  return (
    <section
      aria-label="Campaign examples"
      className="lp-showcase"
      data-motion-active={playing}
      ref={stageRef}
    >
      {examples.map((example, index) => (
        <div
          aria-hidden={active !== index}
          className="lp-example"
          data-active={active === index}
          data-example={example.id}
          inert={active !== index || undefined}
          key={example.id}
        >
          <div className="lp-socialCase">
            <video
              aria-label={example.label}
              loop
              muted
              playsInline
              poster={example.poster}
              preload="metadata"
            >
              <source src={example.video} type="video/mp4" />
            </video>
            <SocialAuthor />
            <SocialRail counts={example.rail} />
          </div>

          {example.id === "skincare" && (
            <>
              <FunnelCard />
              <EngagementCard />
              <SalesPill />
            </>
          )}

          {example.id === "fashion" && (
            <>
              <RoasCard />
              <TimeSavedCard active={active === index} reducedMotion={reducedMotion} />
              <LivePill />
            </>
          )}

          {example.id === "collectible" && (
            <>
              <PostCard liked={liked} onLike={() => setLiked((value) => !value)} />
              <RatingPill />
              <TotalSales />
            </>
          )}
        </div>
      ))}

      <section aria-label="Choose campaign example" className="lp-exampleDots">
        {examples.map((example, index) => (
          <ToggleButton
            aria-label={`Show ${example.id} example`}
            className="lp-exampleDot"
            isSelected={active === index}
            key={example.id}
            onChange={() => selectExample(index)}
          >
            <span className="lp-exampleTrack">
              {active === index && (
                <span
                  className="lp-exampleProgress"
                  onAnimationEnd={() => selectExample((index + 1) % examples.length)}
                />
              )}
            </span>
          </ToggleButton>
        ))}
      </section>
    </section>
  );
}
