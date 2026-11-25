import { publicImageUrl } from "../../lib/public-image-url";
import type { CommerceToolId } from "../commerce/commerce-tools";

/** 创作表单和工具菜单使用同一份示例图地址。 */
export const workspaceToolHeroImages = {
  create: publicImageUrl("/studio/tool-heroes/running-shoe-studio.webp"),
  variation: publicImageUrl("/studio/tool-heroes/image-set-backpack.webp"),
  replica: publicImageUrl("/studio/tool-heroes/style-match-headphones.webp"),
  textile: publicImageUrl("/landing/comforter-studio.webp"),
} as const satisfies Record<CommerceToolId, string>;

type ToolCategory = {
  label: "productImages" | "categoryTools";
  sections: readonly {
    heading: "listingImages" | "photography" | "textiles";
    entries: readonly { tool: CommerceToolId; preview: string }[];
  }[];
};

/** 首页和工作区共用的可用工具目录，类别只随已接通的工具扩展。 */
export const workspaceToolCategories = [
  {
    label: "productImages",
    sections: [
      {
        heading: "listingImages",
        entries: [
          { tool: "create", preview: workspaceToolHeroImages.create },
          { tool: "variation", preview: workspaceToolHeroImages.variation },
        ],
      },
      {
        heading: "photography",
        entries: [{ tool: "replica", preview: workspaceToolHeroImages.replica }],
      },
    ],
  },
  {
    label: "categoryTools",
    sections: [
      {
        heading: "textiles",
        entries: [{ tool: "textile", preview: workspaceToolHeroImages.textile }],
      },
    ],
  },
] as const satisfies readonly ToolCategory[];

/** 单个导航类别及其分组。 */
export type WorkspaceToolCategory = ToolCategory;
