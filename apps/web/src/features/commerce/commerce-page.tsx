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
