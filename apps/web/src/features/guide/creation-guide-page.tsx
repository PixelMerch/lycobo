import { useLayoutEffect } from "react";
import { shellMessages } from "../../app/shell-messages";
import { RouteLink } from "../../components/router-link";
import { useMessages } from "../../i18n/messages";
import { useAppLocation } from "../../i18n/use-localized-navigation";
import { dashboardToolPaths } from "../../lib/dashboard-paths";
import { SiteFooter } from "../site/site-footer";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { creationGuideMessages } from "./creation-guide-messages";
import { creationGuidePath } from "./creation-guide-path";
import "./creation-guide-page.css";

const guideTools = {
  "main-image": "create",
  "image-set": "variation",
  "textile-variations": "textile",
  "style-match": "replica",
} as const;

/** 展示公开创作指南，带章节链接和对应的工作区入口。 */
export function CreationGuidePage() {
  const t = useMessages(creationGuideMessages);
  const { creationHelp: title } = useMessages(shellMessages);
  const { tools } = useMessages(workspaceToolMessages);
  const { hash } = useAppLocation();
  const sections = Object.entries(guideTools).map(([id, tool]) => ({
    id,
    title: tools[tool].name,
    steps: t.tools[tool],
    path: dashboardToolPaths[tool],
  }));
  const topics = [...sections, { id: "results", title: t.results, steps: t.resultSteps }];

  useLayoutEffect(() => {
    const heading = document.getElementById(hash.slice(1));
    if (heading) {
      heading.scrollIntoView({ block: "start", behavior: "instant" });
      heading.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [hash]);

  return (
    <div className="creation-guide-page">
      <div className="creation-guide-layout">
        <header className="creation-guide-heading">
          <h1 id="guide-title">{title}</h1>
          <p>{t.intro}</p>
        </header>
        <nav className="creation-guide-contents" aria-label={t.contents}>
          <p>{t.contents}</p>
          <ul>
            {topics.map((section) => (
              <li key={section.id}>
                <RouteLink to={`${creationGuidePath}#${section.id}`}>{section.title}</RouteLink>
              </li>
            ))}
          </ul>
        </nav>
        <article className="creation-guide-document" aria-labelledby="guide-title">
          {topics.map((section) => (
            <section className="creation-guide-section" key={section.id}>
              <h2 id={section.id} tabIndex={-1}>
                {section.title}
              </h2>
              <ol>
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {"path" in section && (
                <RouteLink to={section.path} className="creation-guide-tool-link">
                  {t.openTool(section.title)}
                </RouteLink>
              )}
            </section>
          ))}
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}
