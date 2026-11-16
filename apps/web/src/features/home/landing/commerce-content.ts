const asset = (name: string) => `/landing/commerce/${name}.webp`;

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
    id: "image-set",
    image: asset("p06-tote-hero"),
    collage: [asset("p06-tote-hero"), asset("p06-scene"), asset("p06-ring")],
    tool: "variation",
    action: "use",
  },
  {
    id: "everyday",
    image: asset("p02-kitchen"),
    tool: "create",
    action: "use",
  },
  {
    id: "studio",
    image: asset("p01-serum-hero"),
    tool: "create",
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
