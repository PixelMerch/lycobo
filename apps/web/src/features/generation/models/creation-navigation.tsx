import { Dropdown } from "@heroui/react";
import { IconCheck, IconSparkles } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { FeatureNavigation } from "../../../components/feature-navigation";
import { UiIcon } from "../../../components/ui-icon";
import { useStudioStore } from "../studio-state";

const navigationModels = [
  {
    id: "gpt-image-2",
    cover: "image-2",
    description: "商品展示与日常图片编辑",
    capabilities: "图文生成 · 参考图编辑",
  },
  {
    id: "gpt-image-2.5",
    cover: "image-2-5",
    description: "商业摄影与创意海报",
    capabilities: "文字排版 · 写实画面",
  },
  {
    id: "nano-banana-2.1",
    cover: "banana",
    description: "商品、人像与场景创作",
    capabilities: "场景生成 · 创意表达",
  },
] as const;

export function CreationNavigation({
  collapsed,
  mobile,
  onNavigate,
}: {
  collapsed: boolean;
  mobile: boolean;
  onNavigate: () => void;
}) {
  const activeModel = useStudioStore((s) => s.activeModel);
  const setActiveModel = useStudioStore((s) => s.setActiveModel);
  const navigate = useNavigate();
  return (
    <FeatureNavigation
      label="创作"
      href="/create"
      icon={IconSparkles}
      triggerLabel="浏览模型"
      heading="选择创作模型"
      collapsed={collapsed}
      mobile={mobile}
      onNavigate={onNavigate}
      className="creation-nav-row"
      menuClassName="creation-model-menu"
      onSelect={(key) => {
        const model = navigationModels.find((item) => item.id === key);
        if (!model) return;
        setActiveModel(model.id);
        navigate("/create");
      }}
    >
      {navigationModels.map((model) => (
        <Dropdown.Item
          key={model.id}
          id={model.id}
          textValue={model.id}
          aria-label={`进入 ${model.id} 创作`}
          className="feature-tool-card"
        >
          <img
            src={`/studio/models/${model.cover}-1.webp`}
            width="64"
            height="64"
            alt=""
            decoding="async"
            draggable={false}
          />
          <span className="feature-tool-copy">
            <span className="feature-tool-title">{model.id}</span>
            <span className="feature-tool-description">{model.description}</span>
            <span className="feature-tool-capabilities">{model.capabilities}</span>
          </span>
          {activeModel === model.id && (
            <UiIcon icon={IconCheck} size="small" className="feature-tool-current" />
          )}
          {activeModel === model.id && <span className="sr-only">当前模型</span>}
        </Dropdown.Item>
      ))}
    </FeatureNavigation>
  );
}
