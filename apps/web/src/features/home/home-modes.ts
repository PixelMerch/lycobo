import { storyboardOriginalImageLimit } from "@lycoboai/contracts";
import {
  IconBackground,
  IconBulb,
  IconCameraRotate,
  IconConfetti,
  IconFolder,
  IconHomeHeart,
  IconLayoutCollage,
  IconListDetails,
  IconPackage,
  IconPhoto,
  IconPhotoPlus,
  IconPlant2,
  IconRotate360,
  IconShoppingBag,
  IconSparkles,
  IconSunHigh,
  IconZoomIn,
  type TablerIcon,
} from "@tabler/icons-react";
import { workspaceTools } from "../workspace/workspace-state";

type WorkspaceTool = (typeof workspaceTools)[number];

/** 首页创作模式与工作区四个工具一一对应。 */
export type HomeModeId = WorkspaceTool["id"];

/** 模板只把示例描述写进草稿，不上传示例、不提交任务。 */
export type HomeTemplate = { name: string; icon: TablerIcon; prompt: string };

/** 上传列的两行入口：两行都打开同一个文件选择框，第一张图在工具里作为主图。 */
type UploadRow = { label: string; icon: TablerIcon };

type ModeCopy = {
  /** 标语按逗号分成两段，窄屏只在逗号后换行。 */
  slogan: [string, string];
  /** 标语第二段里用当前模式强调渐变突出的关键词。 */
  sloganHighlight: string;
  upload: [UploadRow, UploadRow];
  uploadLimit: number;
  placeholder: string;
  templates: HomeTemplate[];
};

const modeCopy: Record<HomeModeId, ModeCopy> = {
  create: {
    slogan: ["让每件商品，", "都有一张好主图"],
    sloganHighlight: "好主图",
    upload: [
      { label: "商品图", icon: IconShoppingBag },
      { label: "参考图", icon: IconFolder },
    ],
    uploadLimit: 5,
    placeholder: "描述你想要的画面，输入 @ 引用已上传图片",
    templates: [
      {
        name: "白底主图",
        icon: IconBackground,
        prompt:
          "保留参考商品的外观、颜色和细节，使用纯白背景与柔和棚拍光，商品居中完整展示，生成一张干净的电商白底主图，不添加文字。",
      },
      {
        name: "场景主图",
        icon: IconHomeHeart,
        prompt: "保留参考商品的外观和细节，为商品搭配真实自然的使用场景，光线柔和，突出商品主体。",
      },
      {
        name: "活动主图",
        icon: IconConfetti,
        prompt:
          "保留参考商品的外观和细节，营造节日促销氛围，背景简洁有层次，为活动文案预留空间，不生成文字。",
      },
      {
        name: "创意海报",
        icon: IconSparkles,
        prompt: "保留参考商品的外观和细节，创作一张突出商品的商业海报。",
      },
      {
        name: "细节特写",
        icon: IconZoomIn,
        prompt: "保留参考商品的材质与做工，近距离拍摄商品细节，浅景深，清晰展现纹理与工艺。",
      },
    ],
  },
  textile: {
    slogan: ["一张家纺主图，", "裂变整套视角"],
    sloganHighlight: "整套视角",
    upload: [
      { label: "家纺主图", icon: IconLayoutCollage },
      { label: "详情图", icon: IconPhotoPlus },
    ],
    uploadLimit: 6,
    placeholder: "",
    templates: [],
  },
  variation: {
    slogan: ["整套商品图，", "先规划再生成"],
    sloganHighlight: "先规划",
    upload: [
      { label: "商品图", icon: IconShoppingBag },
      { label: "参考图", icon: IconFolder },
    ],
    uploadLimit: 5,
    placeholder: "描述整套图片的用途、场景和卖点，输入 @ 引用商品图",
    templates: [
      {
        name: "详情页套图",
        icon: IconListDetails,
        prompt:
          "为这件商品规划一套详情页图片：首图展示商品全貌，后续依次展示核心卖点、材质细节、使用场景和尺寸信息。",
      },
      {
        name: "卖点套图",
        icon: IconBulb,
        prompt:
          "围绕商品的三到五个核心卖点规划一套图片，每张突出一个卖点，整体风格统一，适合主图轮播。",
      },
      {
        name: "场景套图",
        icon: IconPlant2,
        prompt: "把商品放进不同的真实使用场景，每张图一个场景，保持商品外观一致，光线自然。",
      },
      {
        name: "多角度展示",
        icon: IconRotate360,
        prompt: "从正面、侧面、背面和细节特写等角度展示商品，背景简洁统一，完整呈现商品外观。",
      },
    ],
  },
  video: {
    slogan: ["让商品图片，", "动起来讲卖点"],
    sloganHighlight: "动起来",
    upload: [
      { label: "商品主图", icon: IconShoppingBag },
      { label: "补充参考", icon: IconPhoto },
    ],
    uploadLimit: storyboardOriginalImageLimit,
    placeholder: "描述画面主体、动作和镜头运动，例如：晨光卧室，镜头推近展示面料纹理",
    templates: [
      {
        name: "商品展示",
        icon: IconCameraRotate,
        prompt: "商品置于简洁台面，镜头缓慢环绕一周，柔和棚拍光，完整展示商品外观。",
      },
      {
        name: "场景氛围",
        icon: IconSunHigh,
        prompt: "晨光洒进温馨的房间，镜头缓缓推近商品，展示它在真实生活中的使用氛围。",
      },
      {
        name: "细节特写",
        icon: IconZoomIn,
        prompt: "微距镜头沿商品表面缓慢平移，突出材质纹理与做工细节，浅景深。",
      },
      {
        name: "开箱展示",
        icon: IconPackage,
        prompt: "俯拍桌面，打开包装取出商品，镜头跟随商品抬起，最后定格在商品正面。",
      },
    ],
  },
};

function toHomeMode(tool: WorkspaceTool) {
  return { id: tool.id, name: tool.name, path: tool.path, ...modeCopy[tool.id] };
}

/** 首页模式顺序与工作区工具坞一致，名称和路径都来自工具定义。 */
export const homeModes = workspaceTools.map(toHomeMode);

/** 首页单个创作模式的完整配置。 */
export type HomeMode = ReturnType<typeof toHomeMode>;

const defaultMode = toHomeMode(workspaceTools[0]);

/** 读取地址里的模式参数，缺失或未知时回到主图制作。 */
export function homeModeFor(value: string | null): HomeMode {
  return homeModes.find((mode) => mode.id === value) ?? defaultMode;
}
