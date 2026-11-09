import { defineMessages } from "../../../i18n/messages";

/** 家纺裂变十个视角的显示名称，按视角 id 查；中文名称与接口约定里的名称一致。 */
export const textileViewMessages = defineMessages({
  "zh-CN": {
    "overhead-wide": "俯拍全景",
    "overhead-close": "俯拍近景",
    "close-up": "近距离特写",
    pillow: "枕头特写",
    "bed-end": "床尾特写",
    "angled-overhead": "45度角俯拍",
    front: "正面",
    "angled-level": "45度角平拍",
    draped: "被子拖地",
    fabric: "面料特写",
  },
  en: {
    "overhead-wide": "Overhead wide",
    "overhead-close": "Overhead close",
    "close-up": "Close-up",
    pillow: "Pillow close-up",
    "bed-end": "Foot of bed",
    "angled-overhead": "45° overhead",
    front: "Front",
    "angled-level": "45° eye level",
    draped: "Draped to floor",
    fabric: "Fabric close-up",
  },
});
