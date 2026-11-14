import { defineMessages } from "../../../i18n/messages";

/** 电商专区案例画廊的标题、说明与每张卡片的可访问文本。 */
export const casesMessages = defineMessages({
  "zh-CN": {
    eyebrow: "商品图案例",
    title: "主图、场景、细节，一款商品多种呈现",
    description: "看商品原图如何变成一组展示图",
    openDetails: (title: string) => `查看${title}的大图`,
    referenceAlt: "外套商品母图",
    cards: {
      serum: { title: "精华主图", alt: "琥珀色精华瓶的暖白棚拍主图" },
      jacket: {
        title: "服装细节套图",
        alt: "同一件运动外套的穿着整体图与拉链、领口、袖口、面料、侧袋和使用场景细节",
      },
      sneakers: { title: "运动鞋场景", alt: "米白运动鞋放在清晨城市台阶上的场景图" },
      headphones: { title: "耳机细节", alt: "石墨色头戴耳机的头梁与耳垫质感细节" },
      coffee: { title: "咖啡产品图", alt: "无品牌咖啡袋与少量咖啡豆的暖色产品图" },
      tote: { title: "通勤包场景", alt: "棕色通勤托特包放在明亮工作台上的场景图" },
      perfume: { title: "香氛主图", alt: "透明香水瓶在浅灰背景中的柔和折射主图" },
      bedding: { title: "家纺多视角", alt: "米白细条纹床品的卧室全景" },
      pet: { title: "萌宠用品", alt: "鼠尾草绿宠物碗在干净生活场景中的图片" },
      tableware: { title: "餐具场景", alt: "奶油色陶瓷杯碟放在早餐桌上的场景图" },
    },
    detailAlt: {
      zipper: "同一件外套的银色拉链齿与包边近景",
      collar: "同一件外套的立领与领口接缝近景",
      cuff: "同一件外套的袖口与拇指孔近景",
      fabric: "同一件外套的面料纹理与缝线近景",
      pocket: "同一件外套的侧袋开口与走线近景",
      scene: "同一位模特穿着同一件外套在清晨步道行走",
    },
  },
  en: {
    eyebrow: "Product examples",
    title: "Product shots, scenes and close-ups",
    description: "See a product reference become a coordinated image set",
    openDetails: (title: string) => `View ${title} in full size`,
    referenceAlt: "Jacket product reference",
    cards: {
      serum: { title: "Skincare hero", alt: "Amber serum bottle on a warm white studio set" },
      jacket: {
        title: "Apparel detail set",
        alt: "One jacket worn, with zipper, collar, cuff, fabric, pocket and in-use details",
      },
      sneakers: {
        title: "Sneakers in context",
        alt: "Cream sneakers on city steps in morning light",
      },
      headphones: {
        title: "Headphone details",
        alt: "Graphite headphones with headband and cushion texture",
      },
      coffee: {
        title: "Coffee product shot",
        alt: "Unbranded coffee bag with a few roasted beans",
      },
      tote: { title: "Everyday bag scene", alt: "Brown tote bag on a bright worktable" },
      perfume: {
        title: "Fragrance hero",
        alt: "Clear perfume bottle with soft refraction on light grey",
      },
      bedding: { title: "Textile views", alt: "Cream striped bedding across a calm bedroom" },
      pet: { title: "Pet essentials", alt: "Sage green pet bowl in a clean home setting" },
      tableware: {
        title: "Tableware scene",
        alt: "Cream ceramic cup and saucer on a breakfast table",
      },
    },
    detailAlt: {
      zipper: "Close view of the same jacket's silver zipper and trim",
      collar: "Close view of the same jacket's stand collar and seam",
      cuff: "Close view of the same jacket's cuff and thumb hole",
      fabric: "Close view of the same jacket's knit texture and stitching",
      pocket: "Close view of the same jacket's side pocket opening",
      scene: "The same model wearing the same jacket on a morning path",
    },
  },
});
