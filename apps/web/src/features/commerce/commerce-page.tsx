import { EmptyState } from "@heroui/react";
import { RouteLink } from "../../components/router-link";
import { commerceTools } from "./commerce-tools";
import "./commerce.css";

export function CommercePage() {
  return (
    <section className="page-panel commerce-page" aria-labelledby="commerce-title">
      <div className="page-heading">
        <h1 id="commerce-title">AI 电商</h1>
      </div>
      <p className="muted">围绕商品主图，制作电商所需的图片素材</p>
      <div className="commerce-tools">
        {commerceTools.map((tool) => (
          <RouteLink key={tool.id} to={tool.href} className="commerce-tool-link">
            <img src={tool.image} width="64" height="64" alt="" />
            <span className="feature-tool-copy">
              <span className="feature-tool-title">{tool.name}</span>
              <span className="feature-tool-description">{tool.description}</span>
              <span className="feature-tool-capabilities">
                {tool.capabilities} · {tool.status}
              </span>
            </span>
          </RouteLink>
        ))}
      </div>
    </section>
  );
}

export function TextileSetPage() {
  return (
    <section className="page-panel commerce-page" aria-labelledby="textile-set-title">
      <div className="page-heading">
        <h1 id="textile-set-title">家纺套图</h1>
      </div>
      <EmptyState className="commerce-coming-soon">
        <h2>家纺套图即将上线</h2>
        <p>从一张家纺主图延展多视角与细节图片。你可以先使用图片创作制作商品素材。</p>
        <RouteLink to="/create" className="commerce-create-link">
          前往创作
        </RouteLink>
      </EmptyState>
    </section>
  );
}
