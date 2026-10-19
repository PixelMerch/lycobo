import { IconFolder } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { models, useStudioStore } from "./studio-state";
export function AssetsPage() {
  const drafts = useStudioStore((s) => s.drafts);
  const references = models.flatMap((model) =>
    drafts[model.id].references.map((image) => ({ ...image, key: `${model.id}-${image.id}` })),
  );
  return (
    <section className="page-panel assets-page">
      <div className="page-heading">
        <div>
          <h1>素材库</h1>
          <p>当前创作中的参考图片</p>
        </div>
      </div>
      {references.length ? (
        <div className="asset-grid">
          {references.map((image) => (
            <article className="case-card" key={image.key}>
              <img src={image.src} alt={image.name} />
              <div>
                <h2>{image.name}</h2>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <UiIcon icon={IconFolder} size="illustration" />
          <h2>还没有参考图片</h2>
          <p>在创作工作台添加的参考图会显示在这里。</p>
        </div>
      )}
    </section>
  );
}
