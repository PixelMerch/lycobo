import type { TablerIcon } from "@tabler/icons-react";

const sizes = { small: 14, default: 18, navigation: 20, action: 22, illustration: 28 } as const;

/** Shared decorative icon scale. Name interactive controls with their own accessible label. */
export function UiIcon({
  icon: Icon,
  size = "default",
}: {
  icon: TablerIcon;
  size?: keyof typeof sizes;
}) {
  return (
    <Icon
      style={{ width: sizes[size], height: sizes[size] }}
      size={sizes[size]}
      stroke={2}
      aria-hidden="true"
      focusable="false"
      className="ui-icon"
    />
  );
}
