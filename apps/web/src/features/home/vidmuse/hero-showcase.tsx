import { ToggleButton } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

const examples = [
  {
    id: "skincare",
    video: "/vidmuse/skincare.mp4",
    poster: "/vidmuse/skincare.jpg",
    label: "Beauty creator holding a skincare serum",
    rail: ["12.8k", "186", "942"],
    stats: ["Increase Sales"],
  },
  {
    id: "fashion",
    video: "/vidmuse/fashion.mp4",
    poster: "/vidmuse/fashion.jpg",
    label: "Fashion creator in a yellow suit",
    rail: ["24.6k", "328", "1.6k"],
    stats: ["3.8k live watching"],
  },
  {
    id: "collectible",
    video: "/vidmuse/collectible.mp4",
    poster: "/vidmuse/collectible.jpg",
    label: "Pastel collectible character",
    rail: ["18.3k", "264", "1.2k"],
    stats: ["$6.2k"],
  },
] as const;

function SocialAuthor() {
  return (
    <div className="vm-socialAuthor">
      <span className="vm-authorAvatar">
        <img alt="" src="/vidmuse/avatar-base.svg" />
        <span className="vm-authorAvatarMark">
          <img alt="" src="/vidmuse/avatar-mark.svg" />
        </span>
        <img alt="" src="/vidmuse/avatar-ring.svg" />
      </span>
      <span>
        <span className="vm-authorName">
          VidMuse
          <span className="vm-verified">
            <img alt="" src="/vidmuse/verified.svg" />
          </span>
        </span>
        <small>Sponsored</small>
      </span>
    </div>
  );
}

function SocialRail({ counts }: { counts: readonly string[] }) {
  return (
    <div className="vm-socialRail">
      <span>
        <i>
          <img alt="" src="/vidmuse/heart.svg" />
        </i>
        {counts[0]}
      </span>
      <span>
        <i>
          <img alt="" src="/vidmuse/comment.svg" />
        </i>
        {counts[1]}
      </span>
      <span>
        <i>
          <img alt="" src="/vidmuse/share.svg" />
        </i>
        {counts[2]}
      </span>
      <span>
        <i>
          <img alt="" src="/vidmuse/more.svg" />
        </i>
      </span>
    </div>
  );
}

function FunnelCard() {
  return (
    <div className="vm-funnel">
      <strong>Funnel Conversion</strong>
      <div className="vm-funnelPanel">
        <div className="vm-funnelHead">
          <span>Conversion</span>
          <span>Added to cart</span>
        </div>
        <div className="vm-funnelNumbers">
          <span>
            <b>86%</b>
            <em>
              <i>
                <img alt="" src="/vidmuse/up-arrow.svg" />
              </i>
              9%
            </em>
            <small>Last 4 weeks</small>
          </span>
          <span>
            <b>79%</b>
            <em>
              <i>
                <img alt="" src="/vidmuse/up-arrow.svg" />
              </i>
              6%
            </em>
            <small>Last 4 weeks</small>
          </span>
        </div>
        <div className="vm-funnelCharts">
          <i>
            <img alt="" src="/vidmuse/chart-blue.svg" />
          </i>
          <i>
            <img alt="" src="/vidmuse/chart-purple.svg" />
          </i>
        </div>
      </div>
    </div>
  );
}

function EngagementCard() {
  return (
    <div className="vm-engagement">
      <span>Engagement</span>
      <strong>+48%</strong>
      <i>
        <img alt="" src="/vidmuse/eng-arrow.svg" />
      </i>
    </div>
  );
}

function SalesPill() {
  return (
    <div className="vm-salesPill">
      <i>
        <img alt="" src="/vidmuse/check-circle.svg" />
      </i>
      Increase Sales
    </div>
  );
}

function RoasCard() {
  return (
    <div className="vm-roas">
      <small>
        <i>
          <img alt="" src="/vidmuse/up-arrow.svg" />
        </i>
        ROAS
      </small>
      <strong>4.2X</strong>
      <span>Higher return on ad spend</span>
    </div>
  );
}

function TimeSavedCard({ active }: { active: boolean }) {
  const [fill, setFill] = useState(0);

  useEffect(() => {
    if (!active) {
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
  }, [active]);

  const progress = Math.round(fill * 97);
  const radius = 28.3262;
  const circumference = 2 * Math.PI * radius;
  // 与参考图一致：停在 97% 时保留顶部一小段装饰缺口。
  const ringRatio = fill * 0.97 * 0.91;
  const startAngle = -79.2;
  const startRad = (startAngle * Math.PI) / 180;
  const startX = 33.5 + radius * Math.cos(startRad);
  const startY = 33.5 + radius * Math.sin(startRad);

  return (
    <div className="vm-timeSaved">
      <i>
        <svg aria-hidden="true" className="vm-productionRing" viewBox="0 0 67 67">
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
    <div className="vm-livePill">
      <i>
        <img alt="" src="/vidmuse/live-circle.svg" />
      </i>
      3.8k live watching
    </div>
  );
}

function PostCard({ liked, onLike }: { liked: boolean; onLike: () => void }) {
  return (
    <div className="vm-post">
      <div>
        <img alt="Creator holding the collectible character" src="/vidmuse/post-pic.webp" />
      </div>
      <span>
        <ToggleButton
          aria-label="Like campaign example"
          className="vm-postLike"
          isSelected={liked}
          onChange={onLike}
        >
          <i>
            <img alt="" src="/vidmuse/ig-heart.svg" />
          </i>
        </ToggleButton>
        <i>
          <img alt="" src="/vidmuse/ig-comment.svg" />
        </i>
        <i>
          <img alt="" src="/vidmuse/ig-share.svg" />
        </i>
      </span>
    </div>
  );
}

function RatingPill() {
  return (
    <div className="vm-rating">
      <img alt="Five star campaign rating" src="/vidmuse/bubble.svg" />
    </div>
  );
}

function TotalSales() {
  return (
    <div className="vm-totalSales">
      Total Sales
      <strong>$6.2k</strong>
    </div>
  );
}

/** 首屏右侧三组社媒广告示例轮播与浮层数据。 */
export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState(false);
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timerRef.current = window.setInterval(() => {
      setActive((value) => (value + 1) % examples.length);
      setCycle((value) => value + 1);
    }, 6000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const selectExample = (index: number) => {
    setActive(index);
    setCycle((value) => value + 1);
    setLiked(false);
  };

  return (
    <section aria-label="Campaign examples" className="vm-showcase" data-motion-active>
      {examples.map((example, index) => (
        <div
          aria-hidden={active !== index}
          className="vm-example"
          data-active={active === index}
          data-example={example.id}
          inert={active !== index || undefined}
          key={example.id}
        >
          <div className="vm-socialCase">
            <video
              aria-label={example.label}
              autoPlay
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
              <TimeSavedCard active={active === index} />
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

      <section aria-label="Choose campaign example" className="vm-exampleDots">
        {examples.map((example, index) => (
          <ToggleButton
            aria-label={`Show ${example.id} example`}
            className="vm-exampleDot"
            isSelected={active === index}
            key={example.id}
            onChange={() => selectExample(index)}
          >
            <span className="vm-exampleTrack">
              {active === index && (
                <span className="vm-exampleProgress" key={`${example.id}-${cycle}`} />
              )}
            </span>
          </ToggleButton>
        ))}
      </section>
    </section>
  );
}
