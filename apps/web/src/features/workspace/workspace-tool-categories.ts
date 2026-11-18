import { IconAdjustments, IconPhoto, IconShoppingBag } from "@tabler/icons-react";
import type { navigationMessages } from "../home/landing/navigation-messages";
import type { visibleWorkspaceTools } from "./workspace-state";

type CopyKey = keyof (typeof navigationMessages)["zh-CN"];
type ToolId = (typeof visibleWorkspaceTools)[number]["id"];

type CategoryEntry = {
  label: CopyKey | "styleMatch";
  description?: CopyKey;
  tool?: ToolId;
};

type CategorySection = {
  heading?: CopyKey;
  entries: readonly CategoryEntry[];
};

type ToolCategory = {
  label: CopyKey;
  icon: typeof IconPhoto;
  sections: readonly CategorySection[];
};

/** 工作区沿用首页的三个分类和文案，只有已接通的工具声明跳转目标。 */
export const workspaceToolCategories = [
  {
    label: "copy001",
    icon: IconShoppingBag,
    sections: [
      {
        heading: "copy010",
        entries: [
          { label: "copy011", description: "copy012", tool: "create" },
          { label: "copy085", tool: "variation" },
          { label: "copy015", description: "copy016" },
          { label: "copy017", description: "copy018" },
          { label: "copy019", description: "copy020" },
          { label: "copy021", description: "copy022" },
          { label: "copy023", description: "copy024" },
          { label: "copy025", description: "copy026" },
          { label: "copy027", description: "copy028" },
        ],
      },
      {
        heading: "copy029",
        entries: [
          { label: "copy030", description: "copy031" },
          { label: "copy013", description: "copy014" },
          { label: "copy033", description: "copy034" },
        ],
      },
      {
        heading: "copy035",
        entries: [
          { label: "copy036", description: "copy037", tool: "create" },
          { label: "copy038", description: "copy039" },
          { label: "copy040", description: "copy041" },
        ],
      },
      {
        heading: "copy042",
        entries: [
          { label: "copy043", description: "copy044" },
          { label: "copy045", description: "copy046", tool: "textile" },
          { label: "styleMatch", tool: "replica" },
        ],
      },
    ],
  },
  {
    label: "copy002",
    icon: IconPhoto,
    sections: [
      {
        heading: "copy053",
        entries: [
          { label: "copy054" },
          { label: "copy056" },
          { label: "copy057" },
          { label: "copy058" },
          { label: "copy059" },
          { label: "copy060" },
          { label: "copy061" },
          { label: "copy062" },
          { label: "copy063" },
          { label: "copy064" },
        ],
      },
      {
        heading: "copy065",
        entries: [
          { label: "copy066", tool: "create" },
          { label: "copy067" },
          { label: "copy068" },
          { label: "copy069" },
          { label: "copy070" },
        ],
      },
      {
        heading: "copy071",
        entries: [{ label: "copy072", tool: "textile" }],
      },
    ],
  },
  {
    label: "copy003",
    icon: IconAdjustments,
    sections: [
      {
        entries: [
          { label: "copy075" },
          { label: "copy076", tool: "create" },
          { label: "copy077" },
          { label: "copy078" },
          { label: "copy079" },
          { label: "copy080", tool: "textile" },
          { label: "copy081" },
          { label: "copy082" },
          { label: "copy083" },
          { label: "copy084" },
          { label: "copy085", tool: "variation" },
          { label: "copy086" },
          { label: "copy087" },
          { label: "copy088" },
          { label: "copy089" },
          { label: "styleMatch", tool: "replica" },
        ],
      },
    ],
  },
] as const satisfies readonly ToolCategory[];

/** 侧边目录每个一级菜单的名称、图标及条目。 */
export type WorkspaceToolCategory = ToolCategory;
