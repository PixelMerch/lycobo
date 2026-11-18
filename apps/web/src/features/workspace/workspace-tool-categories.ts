import { IconAdjustments, IconPhoto, IconShoppingBag } from "@tabler/icons-react";
import type { navigationMessages } from "../home/landing/navigation-messages";
import type { visibleWorkspaceTools } from "./workspace-state";

type CopyKey = keyof (typeof navigationMessages)["zh-CN"];
type ToolId = (typeof visibleWorkspaceTools)[number]["id"];

type CategoryEntry = {
  label: CopyKey | "styleMatch";
  description?: CopyKey;
  preview?: string;
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

const previews = {
  studioProduct: "/landing/comforter-studio.webp",
  setPlanner: "/studio/tool-heroes/variation.webp",
  bedding: "/studio/tool-heroes/textile.webp",
  styledBedroom: "/studio/bedroom-thumb.webp",
  throwOnSofa: "/landing/showcase/mint-throw-sofa.webp",
  whiteProduct: "/studio/samples/white-perfume.webp",
  closeup: "/studio/textile-views/close-up.webp",
  fabric: "/studio/textile-views/fabric.webp",
  coloredBedding: "/studio/lavender-thumb.webp",
  productSet: "/studio/set-thumb.webp",
  campaign: "/studio/samples/citrus-splash.webp",
  handbag: "/studio/samples/sunlit-handbag.webp",
  outdoor: "/studio/samples/stone-perfume.webp",
  angle: "/studio/textile-views/angled-level.webp",
  texture: "/landing/showcase/mint-throw-texture.webp",
  pillows: "/studio/textile-views/pillow.webp",
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
          {
            label: "copy011",
            preview: previews.studioProduct,
            description: "copy012",
            tool: "create",
          },
          { label: "copy085", preview: previews.setPlanner, tool: "variation" },
          { label: "copy015", preview: previews.pillows, description: "copy016" },
          { label: "copy017", preview: previews.campaign, description: "copy018" },
          { label: "copy019", preview: previews.fabric, description: "copy020" },
          { label: "copy021", preview: previews.handbag, description: "copy022" },
          { label: "copy023", preview: previews.productSet, description: "copy024" },
          { label: "copy025", description: "copy026" },
          { label: "copy027", preview: previews.coloredBedding, description: "copy028" },
        ],
      },
      {
        heading: "copy029",
        entries: [
          { label: "copy030", preview: previews.styledBedroom, description: "copy031" },
          { label: "copy013", preview: previews.throwOnSofa, description: "copy014" },
          { label: "copy033", preview: previews.coloredBedding, description: "copy034" },
        ],
      },
      {
        heading: "copy035",
        entries: [
          {
            label: "copy036",
            preview: previews.whiteProduct,
            description: "copy037",
            tool: "create",
          },
          { label: "copy038", preview: previews.angle, description: "copy039" },
          { label: "copy040", preview: previews.closeup, description: "copy041" },
        ],
      },
      {
        heading: "copy042",
        entries: [
          { label: "copy043", preview: previews.coloredBedding, description: "copy044" },
          { label: "copy045", preview: previews.bedding, description: "copy046", tool: "textile" },
          { label: "styleMatch", preview: previews.handbag, tool: "replica" },
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
          { label: "copy054", preview: previews.throwOnSofa },
          { label: "copy056", preview: previews.styledBedroom },
          { label: "copy057", preview: previews.studioProduct },
          { label: "copy058", preview: previews.closeup },
          { label: "copy059", preview: previews.handbag },
          { label: "copy060", preview: previews.coloredBedding },
          { label: "copy061", preview: previews.outdoor },
          { label: "copy062" },
          { label: "copy063", preview: previews.productSet },
          { label: "copy064", preview: previews.outdoor },
        ],
      },
      {
        heading: "copy065",
        entries: [
          { label: "copy066", preview: previews.studioProduct, tool: "create" },
          { label: "copy067", preview: previews.campaign },
          { label: "copy068", preview: previews.whiteProduct },
          { label: "copy069", preview: previews.pillows },
          { label: "copy070", preview: previews.texture },
        ],
      },
      {
        heading: "copy071",
        entries: [{ label: "copy072", preview: previews.bedding, tool: "textile" }],
      },
    ],
  },
  {
    label: "copy003",
    icon: IconAdjustments,
    sections: [
      {
        entries: [
          { label: "copy075", preview: previews.styledBedroom },
          { label: "copy076", preview: previews.studioProduct, tool: "create" },
          { label: "copy077", preview: previews.closeup },
          { label: "copy078", preview: previews.handbag },
          { label: "copy079", preview: previews.outdoor },
          { label: "copy080", preview: previews.bedding, tool: "textile" },
          { label: "copy081", preview: previews.coloredBedding },
          { label: "copy082", preview: previews.fabric },
          { label: "copy083", preview: previews.texture },
          { label: "copy084", preview: previews.closeup },
          { label: "copy085", preview: previews.setPlanner, tool: "variation" },
          { label: "copy086", preview: previews.campaign },
          { label: "copy087", preview: previews.productSet },
          { label: "copy088" },
          { label: "copy089" },
          { label: "styleMatch", preview: previews.handbag, tool: "replica" },
        ],
      },
    ],
  },
] as const satisfies readonly ToolCategory[];

/** 侧边目录每个一级菜单的名称、图标及条目。 */
export type WorkspaceToolCategory = ToolCategory;
