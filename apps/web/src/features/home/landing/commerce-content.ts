export type CaseFormat = "compact" | "mid" | "wide";

export type CaseDetailId = "zipper" | "collar" | "cuff" | "fabric" | "pocket" | "scene";

export type CaseId =
  | "serum"
  | "jacket"
  | "sneakers"
  | "headphones"
  | "coffee"
  | "tote"
  | "perfume"
  | "bedding"
  | "pet"
  | "tableware";

export interface CaseCard {
  id: CaseId;
  image: string;
  format: CaseFormat;
  details?: { id: CaseDetailId; image: string }[];
}

const asset = (name: string) => `/landing/commerce/${name}.webp`;

/** 专区案例的可浏览顺序与图片槽位，文案由案例消息目录维护。 */
export const caseCards: CaseCard[] = [
  { id: "serum", image: asset("p01-serum-hero"), format: "compact" },
  {
    id: "jacket",
    image: asset("p11-worn"),
    details: (["zipper", "collar", "cuff", "fabric", "pocket", "scene"] as const).map((id) => ({
      id,
      image: asset(`p11-${id}`),
    })),
    format: "wide",
  },
  { id: "sneakers", image: asset("p03-sneaker-hero"), format: "mid" },
  { id: "headphones", image: asset("p04-headphones-hero"), format: "mid" },
  { id: "coffee", image: asset("p05-coffee-hero"), format: "mid" },
  { id: "tote", image: asset("p06-tote-hero"), format: "mid" },
  { id: "perfume", image: asset("p07-perfume-hero"), format: "compact" },
  { id: "bedding", image: asset("p08-bedding-hero"), format: "mid" },
  { id: "pet", image: asset("p09-petbowl-hero"), format: "mid" },
  { id: "tableware", image: asset("p10-tableware-hero"), format: "mid" },
];

/** Create 规格示例按画幅索引；未列出的比例在固定预览槽内显示画框。 */
export const ratioPreviewImages: Record<string, string> = {
  "1:1": asset("p02-blender-hero"),
  "3:4": asset("p02-ratio-3x4"),
  "9:16": asset("p02-ratio-9x16"),
};

export type FormatTool = "create" | "variation" | "replica" | "textile";

export type FormatId =
  | "studio"
  | "everyday"
  | "footwear"
  | "texture"
  | "food"
  | "image-set"
  | "style-reference"
  | "textile-angles"
  | "backgrounds"
  | "portrait";

export interface CampaignFormat {
  id: FormatId;
  image: string;
  collage?: readonly [string, string, string];
  tool: FormatTool;
  action: "use" | "open";
  ratio?: string;
}

const textileAsset = (name: string) => `/studio/textile-views/${name}.webp`;

/** 画廊卡片混合单张成片与多图组合，展示文案和提示词都在消息目录。 */
export const campaignFormats: CampaignFormat[] = [
  {
    id: "studio",
    image: asset("p01-serum-hero"),
    tool: "create",
    action: "use",
  },
  {
    id: "everyday",
    image: asset("p02-kitchen"),
    tool: "create",
    action: "use",
  },
  {
    id: "image-set",
    image: asset("p06-tote-hero"),
    collage: [asset("p06-tote-hero"), asset("p06-scene"), asset("p06-ring")],
    tool: "variation",
    action: "use",
  },
  {
    id: "footwear",
    image: asset("p03-sneaker-hero"),
    tool: "create",
    action: "use",
  },
  {
    id: "texture",
    image: asset("p06-leather"),
    tool: "create",
    action: "use",
    ratio: "1:1",
  },
  {
    id: "food",
    image: asset("p05-coffee-hero"),
    tool: "create",
    action: "use",
  },
  {
    id: "textile-angles",
    image: textileAsset("front"),
    collage: [textileAsset("front"), textileAsset("pillow"), textileAsset("fabric")],
    tool: "textile",
    action: "open",
  },
  {
    id: "style-reference",
    image: asset("p10-tableware-hero"),
    tool: "replica",
    action: "open",
  },
  {
    id: "backgrounds",
    image: asset("p04-headphones-hero"),
    tool: "variation",
    action: "use",
  },
  {
    id: "portrait",
    image: asset("p07-perfume-hero"),
    tool: "create",
    action: "use",
    ratio: "9:16",
  },
];
