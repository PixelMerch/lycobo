import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { dashboardToolPaths } from "../../../lib/dashboard-paths";
import { landingDemoMessages } from "./landing-demo-messages";
import { landingEase, landingViewport } from "./landing-motion";
import { LandingSectionHeading } from "./landing-section-heading";
import "./landing-demo-section.css";

const productionTabOrder: readonly string[] = ["storyboard", "canvas", "prompt"];

interface ProductionTab {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface StartPoint {
  id: string;
  title: string;
  description: string;
  to: string;
}

function StartingPointsGrid({
  title,
  subtitle,
  items,
  reducedMotion,
}: {
  title: string;
  subtitle: string;
  items: StartPoint[];
  reducedMotion: boolean;
}) {
  return (
    <div className="lp-start-block">
      <div className="lp-start-head">
        <h3 className="lp-start-title">{title}</h3>
        <p className="lp-start-subtitle">{subtitle}</p>
      </div>
      <div className="lp-start-grid">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={landingViewport}
            transition={{ duration: 0.55, delay: index * 0.06, ease: landingEase }}
          >
            <RouteLink to={item.to} className="lp-start-card">
              <div className="lp-start-card-top">
                <span className="lp-start-card-title">{item.title}</span>
                <span className="lp-start-card-icon" aria-hidden="true">
                  <UiIcon icon={IconArrowUpRight} size="small" />
                </span>
              </div>
              <p className="lp-start-card-desc">{item.description}</p>
            </RouteLink>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** 首页复刻 LTX 左侧竖向选项卡控制台（自动/手动切换预览）与 4 列创作起点卡片。 */
export function LandingDemoSection() {
  const t = useMessages(landingDemoMessages);
  const reducedMotion = Boolean(useReducedMotion());
  const [activeId, setActiveId] = useState("storyboard");
  const [paused, setPaused] = useState(false);

  const tabs: ProductionTab[] = [
    {
      id: "storyboard",
      title: t.tabOneTitle,
      description: t.tabOneDesc,
      image: "/landing/ltx/prod-storyboard.webp",
    },
    {
      id: "canvas",
      title: t.tabTwoTitle,
      description: t.tabTwoDesc,
      image: "/landing/ltx/prod-timeline.webp",
    },
    {
      id: "prompt",
      title: t.tabThreeTitle,
      description: t.tabThreeDesc,
      image: "/landing/ltx/prod-sound.webp",
    },
  ];

  const startPoints: StartPoint[] = [
    {
      id: "main-image",
      title: t.startOneTitle,
      description: t.startOneDesc,
      to: dashboardToolPaths.create,
    },
    {
      id: "planner",
      title: t.startTwoTitle,
      description: t.startTwoDesc,
      to: dashboardToolPaths.variation,
    },
    {
      id: "textile",
      title: t.startThreeTitle,
      description: t.startThreeDesc,
      to: dashboardToolPaths.textile,
    },
    {
      id: "replica",
      title: t.startFourTitle,
      description: t.startFourDesc,
      to: dashboardToolPaths.replica,
    },
  ];

  useEffect(() => {
    if (reducedMotion || paused) return;
    const timer = window.setInterval(() => {
      setActiveId((prev) => {
        const currentIndex = productionTabOrder.indexOf(prev);
        return productionTabOrder[(currentIndex + 1) % productionTabOrder.length] ?? "storyboard";
      });
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  if (!activeTab) return null;

  return (
    <section className="lp-console" aria-labelledby="lp-console-title">
      <div className="lp-container">
        <LandingSectionHeading
          id="lp-console-title"
          title={t.sectionTitle}
          description={t.sectionSubtitle}
        />

        <div className="lp-console-grid">
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([activeId])}
            onSelectionChange={(keys) => {
              const selected = [...keys][0];
              if (typeof selected === "string") {
                setPaused(true);
                setActiveId(selected);
              }
            }}
            aria-label={t.tabsAriaLabel}
            className="lp-console-tabs"
          >
            {tabs.map((tab) => {
              const isSelected = tab.id === activeId;
              return (
                <ToggleButton key={tab.id} id={tab.id} className="lp-console-tab">
                  <span className="lp-console-tab-bar" aria-hidden="true">
                    {isSelected ? (
                      <motion.span
                        layoutId="lp-console-active-bar"
                        className="lp-console-tab-bar-fill"
                        transition={{ type: "spring", stiffness: 360, damping: 32 }}
                      />
                    ) : null}
                  </span>
                  <span className="lp-console-tab-copy">
                    <span className="lp-console-tab-title">{tab.title}</span>
                    <span className="lp-console-tab-desc">{tab.description}</span>
                  </span>
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>

          <div className="lp-console-stage lp-glow-frame">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeTab.id}
                src={activeTab.image}
                alt={activeTab.title}
                className="lp-console-img"
                initial={reducedMotion ? false : { opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: reducedMotion ? 1 : 0 }}
                transition={{ duration: 0.38, ease: landingEase }}
                decoding="async"
              />
            </AnimatePresence>
          </div>
        </div>

        <StartingPointsGrid
          title={t.startTitle}
          subtitle={t.startSubtitle}
          items={startPoints}
          reducedMotion={reducedMotion}
        />
      </div>
    </section>
  );
}
