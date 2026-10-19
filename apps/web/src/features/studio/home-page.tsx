import { Button } from "@heroui/react";
import {
  IconArrowRight,
  IconBanana,
  IconChevronRight,
  IconFolder,
  IconPhoto,
  IconShoppingBag,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { CaseGallery } from "./case-gallery";
import { models, useStudioStore } from "./studio-state";
export function HomePage() {
  const setChooserOpen = useStudioStore((s) => s.setChooserOpen);
  const setActiveModel = useStudioStore((s) => s.setActiveModel);
  const recentModels = useStudioStore((s) => s.recentModels);
  return (
    <section className="home-page page-panel">
      <div className="page-heading">
        <div>
          <h1>创作首页</h1>
          <p>从一张图片，开始新的创作</p>
        </div>
        <Button className="primary-action" onPress={() => setChooserOpen(true)}>
          开始创作
        </Button>
      </div>
      <section className="quick-section">
        <h2>常用入口</h2>
        <div className="quick-grid">
          <Button variant="secondary" className="quick-card" onPress={() => setChooserOpen(true)}>
            <UiIcon icon={IconPhoto} size="illustration" />
            <span>
              <strong>图片创作</strong>
              <small>选择模型，自由生图与改图</small>
            </span>
            <UiIcon icon={IconChevronRight} />
          </Button>
          <div className="quick-card subdued">
            <UiIcon icon={IconShoppingBag} size="illustration" />
            <span>
              <strong>AI 电商</strong>
              <small>家纺场景、换色换花型与图文</small>
            </span>
            <span className="quiet-label">即将开放</span>
          </div>
          <Link to="/assets" className="quick-card">
            <UiIcon icon={IconFolder} size="illustration" />
            <span>
              <strong>素材库</strong>
              <small>整理与复用你的创作素材</small>
            </span>
            <UiIcon icon={IconChevronRight} />
          </Link>
        </div>
      </section>
      <CaseGallery />
      <section className="recent-section">
        <h2>最近使用</h2>
        {recentModels.length ? (
          recentModels.map((id) => {
            const model = models.find((item) => item.id === id);
            return model ? (
              <Link className="recent-row" to="/create" key={id} onClick={() => setActiveModel(id)}>
                <UiIcon icon={id === "banana" ? IconBanana : IconPhoto} size="action" />
                <strong>{model.name}</strong>
                <span>进入创作</span>
                <UiIcon icon={IconArrowRight} size="small" />
              </Link>
            ) : null;
          })
        ) : (
          <p className="muted">还没有使用记录，选择一个模型开始吧。</p>
        )}
      </section>
    </section>
  );
}
