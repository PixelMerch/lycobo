import type { CommerceToolId } from "../commerce/commerce-tools";

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
          { tool: "create", preview: "/landing/comforter-studio.webp" },
          { tool: "variation", preview: "/studio/tool-heroes/variation.webp" },
        ],
      },
      {
        heading: "photography",
        entries: [{ tool: "replica", preview: "/studio/samples/sunlit-handbag.webp" }],
      },
    ],
  },
  {
    label: "categoryTools",
    sections: [
      {
        heading: "textiles",
        entries: [{ tool: "textile", preview: "/studio/tool-heroes/textile.webp" }],
      },
    ],
  },
] as const satisfies readonly ToolCategory[];

/** 单个导航类别及其分组。 */
export type WorkspaceToolCategory = ToolCategory;
