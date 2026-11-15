import { IconArrowRight, IconLayoutDashboard } from "@tabler/icons-react";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { commercePath } from "../commerce/commerce-tools";
import { SiteFooter } from "../site/site-footer";
import { HomeInspirationGallery } from "./home-inspiration-gallery";
import { landingMessages } from "./landing/landing-messages";
import "./home-page.css";

/** 品牌首页提供电商专区、工作区与灵感的总入口。 */
export function HomePage() {
  const t = useMessages(landingMessages).home;
  return (
    <div className="lycobo-home">
      <section className="lycobo-home-hero" aria-labelledby="lycobo-home-title">
        <h1 id="lycobo-home-title">{t.title}</h1>
        <p>{t.description}</p>
        <div className="lycobo-home-actions">
          <RouteLink className="lycobo-home-primary" to={commercePath}>
            {t.enterCommerce}
            <UiIcon icon={IconArrowRight} size="small" />
          </RouteLink>
          <RouteLink className="lycobo-home-secondary" to="/workspace">
            <UiIcon icon={IconLayoutDashboard} size="small" />
            {t.workspace}
          </RouteLink>
        </div>
      </section>
      <HomeInspirationGallery />
      <SiteFooter />
    </div>
  );
}
