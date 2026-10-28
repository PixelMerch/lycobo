import { Dropdown } from "@heroui/react";
import { IconCheck, IconSparkles } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { FeatureNavigation } from "../../../components/feature-navigation";
import { UiIcon } from "../../../components/ui-icon";
import { useStudioStore } from "../studio-state";
import { ModelLogo, useModelPresentation } from "./model-logos";

export function CreationNavigation({
  collapsed,
  mobile,
  onNavigate,
}: {
  collapsed: boolean;
  mobile: boolean;
  onNavigate: () => void;
}) {
  const catalog = useModelPresentation();
  const navigationModels = catalog.data?.models ?? [];
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
      {navigationModels.map((model) => {
        const id = model.id;
        const name = model.name ?? id;
        return (
          <Dropdown.Item
            key={id}
            id={id}
            textValue={name}
            aria-label={`进入 ${name} 创作`}
            className="feature-tool-card"
          >
            <ModelLogo src={model.logoUrl} />
            <span className="feature-tool-copy">
              <span className="feature-tool-title">{name}</span>
              {model.description && (
                <span className="feature-tool-description">{model.description}</span>
              )}
              {model.capabilitySummary && (
                <span className="feature-tool-capabilities">{model.capabilitySummary}</span>
              )}
            </span>
            {activeModel === id && (
              <UiIcon icon={IconCheck} size="small" className="feature-tool-current" />
            )}
            {activeModel === id && <span className="sr-only">当前模型</span>}
          </Dropdown.Item>
        );
      })}
    </FeatureNavigation>
  );
}
