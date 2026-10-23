import { Dropdown } from "@heroui/react";
import { IconShoppingBagSearch } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { FeatureNavigation } from "../../components/feature-navigation";
import { commerceTools } from "./commerce-tools";

export function CommerceNavigation({
  collapsed,
  mobile,
  onNavigate,
}: {
  collapsed: boolean;
  mobile: boolean;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  return (
    <FeatureNavigation
      label="AI 电商"
      href="/commerce"
      icon={IconShoppingBagSearch}
      triggerLabel="浏览电商功能"
      heading="电商创作工具"
      collapsed={collapsed}
      mobile={mobile}
      onNavigate={onNavigate}
      className="commerce-nav-row"
      menuClassName="commerce-function-menu"
      onSelect={(key) => {
        const tool = commerceTools.find((item) => item.id === key);
        if (tool) navigate(tool.href);
      }}
    >
      {commerceTools.map((tool) => (
        <Dropdown.Item
          key={tool.id}
          id={tool.id}
          textValue={tool.name}
          aria-label={`查看${tool.name}`}
          className="feature-tool-card"
        >
          <img src={tool.image} width="64" height="64" alt="" decoding="async" draggable={false} />
          <span className="feature-tool-copy">
            <span className="feature-tool-title">{tool.name}</span>
            <span className="feature-tool-description">{tool.description}</span>
            <span className="feature-tool-capabilities">
              {tool.capabilities} · {tool.status}
            </span>
          </span>
        </Dropdown.Item>
      ))}
    </FeatureNavigation>
  );
}
