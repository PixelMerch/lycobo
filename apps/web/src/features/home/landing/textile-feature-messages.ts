import { defineMessages } from "../../../i18n/messages";

/** 家纺展示以拍摄用途解释全景、枕套、织纹与床尾视角。 */
export const textileFeatureMessages = defineMessages({
  "zh-CN": {
    title: "从卧室全景，\n到一寸织纹。",
    description: "一款床品，多种拍法。选好视角，让空间氛围、面料纹理与垂坠细节各有一张好图。",
    action: "制作家纺套图",
    choose: "选择床品展示视角",
    open: "放大查看床品图片",
    views: {
      front: { title: "卧室全景", description: "展示床品配色与铺床效果，用于商品主图与场景展示" },
      pillow: { title: "枕套细节", description: "靠近枕套，呈现轮廓、绗缝与边缘做工" },
      fabric: { title: "面料纹理", description: "以近距离光影呈现织纹、绗缝和面料的起伏" },
      "bed-end": { title: "床尾垂感", description: "从床尾看被面铺展、收边与自然垂落的形态" },
    },
  },
  en: {
    title: "The whole room.\nEvery woven detail.",
    description:
      "One bedding collection, many perspectives. Give the room, the fabric and the drape their own image.",
    action: "Create a textile set",
    choose: "Choose a bedding view",
    open: "View bedding images full screen",
    views: {
      front: {
        title: "The whole room",
        description: "Show the palette and dressed bed in a product hero or lifestyle scene",
      },
      pillow: {
        title: "Pillow details",
        description: "Move closer to the shape, quilting and finished edges",
      },
      fabric: {
        title: "Fabric texture",
        description: "Bring out the weave, quilting and soft folds with close-up light",
      },
      "bed-end": {
        title: "Natural drape",
        description: "Show how the quilt falls, from the finished hem to the foot of the bed",
      },
    },
  },
});
