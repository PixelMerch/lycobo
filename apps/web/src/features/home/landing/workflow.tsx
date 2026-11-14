import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useStudioStore } from "../../generation/studio-state";
import { comparison, planCards, workflowAssets } from "./commerce-content";
import { Impact } from "./impact";
import { KitPanel } from "./kit-panel";
import { clearSpec, readSpec } from "./spec-intent";
import { useWorkflowScroll, workflowSteps } from "./use-workflow-scroll";
import { workflowMessages } from "./workflow-messages";

const PANEL_MOTION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
};

/** 第一步：同一商品的四张素材，选择只更新查看状态。 */
function ProductAssetsPanel() {
  const t = useMessages(workflowMessages).research;
  const [selected, setSelected] = useState(workflowAssets[0]?.id ?? "full");
  const preview = workflowAssets.slice(1);
  return (
    <>
      <h3>{t.heading}</h3>
      <div className="lp-researchDemo" data-research-stage="done">
        <ToggleButtonGroup
          aria-label={t.heading}
          className="lp-competitors"
          disallowEmptySelection
          isDetached
          selectedKeys={[selected]}
          selectionMode="single"
          onSelectionChange={(keys) => {
            const [next] = keys;
            const asset = workflowAssets.find((item) => item.id === next);
            if (asset) setSelected(asset.id);
          }}
        >
          {workflowAssets.map((asset) => (
            <ToggleButton
              aria-label={t.select(t.cards[asset.id].title)}
              className="lp-competitor"
              id={asset.id}
              key={asset.id}
            >
              <span className="lp-competitorImage">
                <img alt={t.cards[asset.id].alt} loading="lazy" src={asset.image} />
              </span>
              <span aria-hidden="true" className="lp-materialStrip">
                {preview.map((item) => (
                  <i key={`${asset.id}-${item.id}`}>
                    <img alt="" loading="lazy" src={item.image} />
                  </i>
                ))}
              </span>
              <small>{t.cards[asset.id].title}</small>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <div className="lp-analysisLine" />
        <p className="lp-analysisResult" data-stage="done">
          {t.result}
        </p>
      </div>
    </>
  );
}

/** 第二步：同款商品的原图／成片切换与五项方案。 */
function ImagePlanPanel() {
  const t = useMessages(workflowMessages).summarize;
  const [view, setView] = useState<"result" | "reference">("result");
  return (
    <>
      <h3>{t.heading}</h3>
      <div className="lp-summary" data-summary-active="true">
        <div aria-hidden="true" className="lp-scoreRing" />
        <div className="lp-planStage">
          <ToggleButtonGroup
            aria-label={t.toggleLabel}
            className="lp-compareToggle"
            disallowEmptySelection
            isDetached
            selectedKeys={[view]}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const [next] = keys;
              if (next === "reference" || next === "result") setView(next);
            }}
          >
            <ToggleButton id="reference">{t.reference}</ToggleButton>
            <ToggleButton id="result">{t.result}</ToggleButton>
          </ToggleButtonGroup>
          <div className="lp-compareFrame">
            <img
              alt={view === "result" ? t.useNote : t.reference}
              src={view === "result" ? comparison.result : comparison.reference}
            />
            <span className="lp-compareMark">{t.sample}</span>
          </div>
        </div>
        <div className="lp-scoreCards">
          {planCards.map((card) => (
            <div className="lp-scoreCard" data-plan={card.id} key={card.id}>
              <strong>{card.index}</strong>
              <div>
                <b>{t.cards[card.id].title}</b>
                <span>{t.cards[card.id].caption}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** 复刻页商品素材 / 套图方案 / 制作图片滚动工作流。 */
export function Workflow() {
  const t = useMessages(workflowMessages);
  const session = useEnterpriseSession();
  const navigate = useAppNavigate();
  const { railRef, step, kitKey, setKitKey, desktop, selectStep, hold, release } =
    useWorkflowScroll();

  // 登录返回后，空草稿直接带入待用规格；有内容时留给规格面板确认。
  useEffect(() => {
    if (!session.data) return;
    const spec = readSpec();
    if (!spec) return;
    const { activeModel, drafts, updateDraft } = useStudioStore.getState();
    const draft = drafts[activeModel];
    const hasContent = Boolean(draft?.prompt.trim()) || (draft?.references.length ?? 0) > 0;
    if (hasContent) return;
    updateDraft(activeModel, spec);
    clearSpec();
    void navigate("/commerce/create");
  }, [session.data, navigate]);

  return (
    <section aria-labelledby="campaign-research-title" className="lp-research" id="research">
      <div aria-hidden="true" className="lp-researchBackground">
        <img alt="" src="/landing/research-bg.webp" />
      </div>

      <div className="lp-researchHeading">
        <span className="cn-badge lp-researchEyebrow">{t.eyebrow}</span>
        <h2 id="campaign-research-title">{t.title}</h2>
        <p>{t.description}</p>
      </div>

      <div className="lp-workflowRail" data-scroll-enabled={desktop} ref={railRef}>
        <div className="lp-workflowPin">
          <div className="lp-workflow" id="campaign-workflow" data-step={step}>
            <div className="lp-workflowBody">
              <ToggleButtonGroup
                aria-label={t.tabsLabel}
                className="lp-workflowTabs"
                data-step={step}
                disallowEmptySelection
                isDetached
                selectedKeys={[step]}
                selectionMode="single"
                onSelectionChange={(keys) => {
                  const [next] = keys;
                  const found = workflowSteps.find((item) => item.id === next);
                  if (found) selectStep(found.id);
                }}
              >
                <span aria-hidden="true" className="lp-workflowIndicator" />
                {workflowSteps.map((item) => (
                  <ToggleButton id={item.id} key={item.id}>
                    {t.steps[item.id]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <AnimatePresence mode="wait">
                <motion.div {...PANEL_MOTION} className="lp-workflowPanel" key={step}>
                  {step === "research" && <ProductAssetsPanel />}
                  {step === "summarize" && <ImagePlanPanel />}
                  {step === "create" && (
                    <>
                      <h3>{t.create.heading}</h3>
                      <KitPanel
                        expandedKey={kitKey}
                        onExpandedChange={setKitKey}
                        onHold={hold}
                        onRelease={release}
                      />
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <Impact />
    </section>
  );
}
