import { defineMessages } from "../../../i18n/messages";

/** 电商正文的案例章节、模板与入口文案。 */
export const commerceShowcaseMessages = defineMessages({
  "zh-CN": {
    intro: {
      title: "一款商品，\n一整套上架图",
      description: "从同一张原图出发，把商品拍清楚、放进场景，再拉近看细节。",
    },
    shots: {
      original: "商品原图",
      studio: "棚拍主图",
      scene: "自然光厨房",
      alternate: "浅色布景",
      detail: "杯盖与挂绳",
      base: "杯身与底座",
    },
    scenes: {
      title: "同一款商品，\n换个场景",
      description: "自然光交代使用环境，干净的布景把注意力留给商品轮廓。",
      create: "制作场景图",
      style: "参考现有构图",
    },
    set: {
      title: "把细节拍进同一套图",
      description: "先规划主图、场景与特写。确认方案后，再逐张生成。",
      views: "选择图片视角",
      action: "规划我的商品套图",
    },
    gallery: {
      title: "选一个画面，开始制作",
      pause: "暂停案例轮播",
      play: "开始案例轮播",
      previous: "向前浏览案例",
      next: "向后浏览案例",
      description: "从模板带入创作要求，到工作区换成自己的商品。",
    },
    cta: { title: "下一套图，\n从你的商品开始", action: "开始创作", workspace: "进入工作区" },
  },
  en: {
    intro: {
      title: "One product.\nA full set of listing images.",
      description:
        "Start with one photo, show the product in use, then move closer to the details.",
    },
    shots: {
      original: "Original photo",
      studio: "Studio shot",
      scene: "Sunlit kitchen",
      alternate: "Clean backdrop",
      detail: "Lid and strap",
      base: "Cup and base",
    },
    scenes: {
      title: "Same product.\nA different setting.",
      description:
        "Natural light shows the product in context. A clean backdrop brings out its shape.",
      create: "Create a lifestyle shot",
      style: "Use a reference layout",
    },
    set: {
      title: "Give the details a place in the set",
      description:
        "Plan the main image, lifestyle shots and close-ups. Confirm the plan before creating the images.",
      views: "Choose an image angle",
      action: "Plan my image set",
    },
    gallery: {
      title: "Pick a look to start with",
      pause: "Pause examples",
      play: "Play examples",
      previous: "Previous examples",
      next: "Next examples",
      description: "Bring a creative brief into the workspace and add your own product.",
    },
    cta: {
      title: "Start your next set\nwith your product",
      action: "Start creating",
      workspace: "Open workspace",
    },
  },
});
