/** Local AI-generated inspiration examples; not customer work or provider benchmarks. */
export const inspirationCategories = [
  "全部",
  "商品主图",
  "场景灵感",
  "家纺展示",
  "创意视觉",
] as const;
export type InspirationCategory = (typeof inspirationCategories)[number];
export type HomeInspiration = {
  id: string;
  title: string;
  category: Exclude<InspirationCategory, "全部">;
  image: string;
  shape: "portrait" | "square" | "landscape";
  prompt: string;
};
export const homeInspirations: HomeInspiration[] = [
  {
    id: "water-perfume",
    title: "水光香氛",
    category: "商品主图",
    image: "/studio/models/image-2-1.webp",
    shape: "portrait",
    prompt:
      "保留参考商品的外观、颜色和包装，将商品放在水边石台上，用自然阳光与水面反光营造清透的商业摄影画面，不额外添加文字。",
  },
  {
    id: "cream-bedroom",
    title: "原木与晨光",
    category: "场景灵感",
    image: "/studio/bedroom-thumb.webp",
    shape: "square",
    prompt:
      "保留参考床品的颜色、花型、绗缝和套件组成，将床品置于原木卧室中，窗边自然光，画面干净，完整展示商品。",
  },
  {
    id: "glass-flower",
    title: "玻璃花的想象",
    category: "创意视觉",
    image: "/studio/models/banana-1.webp",
    shape: "portrait",
    prompt:
      "以参考商品为主体，搭配透明玻璃花和柔和的折射光，保持商品外观不变，创作清晰、有层次的商业创意画面，不添加文字。",
  },
  {
    id: "white-footwear",
    title: "纯白商品陈列",
    category: "商品主图",
    image: "/studio/models/image-2-3.webp",
    shape: "square",
    prompt:
      "保持参考商品的形状、材质和细节，使用简洁浅色背景，柔和棚拍光线，突出商品轮廓和质感，不增加配件或文字。",
  },
  {
    id: "fashion-blue",
    title: "蓝调时尚大片",
    category: "场景灵感",
    image: "/studio/models/image-2-5-1.webp",
    shape: "portrait",
    prompt:
      "保留参考服装的版型、颜色和面料，在自然采光的户外场景展示，使用商业时尚摄影构图，突出衣料质感与穿着效果。",
  },
  {
    id: "textile-pillow",
    title: "枕间细节",
    category: "家纺展示",
    image: "/studio/textile-views/pillow.webp",
    shape: "square",
    prompt:
      "基于参考床品拍摄枕头特写，保持枕套的颜色、花型和绗缝一致，柔和侧光，清晰展现面料与包边细节。",
  },
  {
    id: "amber-perfume",
    title: "琥珀色的光影",
    category: "商品主图",
    image: "/studio/models/image-2-2.webp",
    shape: "portrait",
    prompt:
      "保留参考商品的外形与包装，搭配暖色光影和克制的背景，用近景商业摄影突出商品的材质、边缘与细节，不添加文字。",
  },
  {
    id: "bag-editorial",
    title: "手袋场景摄影",
    category: "场景灵感",
    image: "/studio/models/image-2-5-2.webp",
    shape: "portrait",
    prompt:
      "保留参考手袋的轮廓、颜色、五金和纹理，在自然简洁的生活场景中展示，突出主体，背景适度虚化，不改变商品设计。",
  },
  {
    id: "lavender-bedding",
    title: "浅紫卧室配色",
    category: "家纺展示",
    image: "/studio/lavender-thumb.webp",
    shape: "square",
    prompt:
      "保持参考床品的绗缝、花型和套件组成，为卧室搭配柔和的浅紫色调与自然光，画面简洁，商品完整展示。",
  },
  {
    id: "paper-metal",
    title: "纸与金属的构成",
    category: "创意视觉",
    image: "/studio/models/image-2-5-3.webp",
    shape: "landscape",
    prompt:
      "围绕参考商品，用纸张和金属材质组织简洁的几何构图，保留商品外观，采用有层次的光影，不添加文字或品牌。",
  },
  {
    id: "textile-fabric",
    title: "看得见的面料",
    category: "家纺展示",
    image: "/studio/textile-views/fabric.webp",
    shape: "square",
    prompt:
      "以参考床品的面料为主体进行近距离特写，保留真实纹理、绗缝和颜色，展现自然褶皱与柔和光线，不虚构材质信息。",
  },
  {
    id: "textile-front",
    title: "一套床品的正面",
    category: "家纺展示",
    image: "/studio/textile-views/front.webp",
    shape: "portrait",
    prompt:
      "从床尾中央平视拍摄参考床品，保持商品颜色、图案、材质和套件组成不变，左右构图平衡，完整展示床头、枕套和被子。",
  },
  {
    id: "folded-textile",
    title: "套件质感陈列",
    category: "商品主图",
    image: "/studio/set-thumb.webp",
    shape: "square",
    prompt:
      "以参考床品为主体，将被子与枕套整齐折叠陈列，保留商品颜色、绗缝和材质纹理，使用干净背景与柔和自然光，不添加文字或品牌。",
  },
];
