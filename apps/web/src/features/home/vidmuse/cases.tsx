import { caseCards } from "./content";

function CaseTrack({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div aria-hidden={ariaHidden} className="vm-casesSet">
      {caseCards.map((card) => (
        <div
          className="vm-caseItem"
          data-format={card.format === "compact" ? undefined : card.format}
          key={card.title}
        >
          <div className="vm-caseCard">
            <img alt={`${card.title} campaign example`} src={card.image} />
            <div>
              <b>{card.title}</b>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 复刻页案例横滑：两组相同内容首尾衔接，悬停由 CSS 暂停。 */
export function Cases() {
  return (
    <section aria-labelledby="campaign-cases-title" className="vm-cases">
      <div className="vm-sectionHeading">
        <span className="cn-badge vm-eyebrow">Creative formats people stop for</span>
        <h2 id="campaign-cases-title">Every category already has a winning look</h2>
        <p>Explore winning visual languages across categories.</p>
      </div>

      <div className="vm-casesCarousel">
        <div className="vm-casesTrack">
          <CaseTrack />
          <CaseTrack ariaHidden />
        </div>
      </div>
    </section>
  );
}
