import { storyboardOriginalImageLimit } from "@lycoboai/contracts";
import {
  IconBackground,
  IconBulb,
  IconCameraRotate,
  IconConfetti,
  IconHomeHeart,
  IconListDetails,
  IconPackage,
  IconPlant2,
  IconRotate360,
  IconSparkles,
  IconSunHigh,
  IconZoomIn,
  type TablerIcon,
} from "@tabler/icons-react";
import type { Locale } from "../../i18n/locale";
import { workspaceTools } from "../workspace/workspace-state";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { homeModeMessages } from "./home-modes-messages";

type WorkspaceTool = Exclude<(typeof workspaceTools)[number], { id: "replica" }>;

/** 首页创作模式与工作区四个工具一一对应。 */
export type HomeModeId = WorkspaceTool["id"];

/** 模板只把示例描述写进草稿，不上传示例、不提交任务。 */
export type HomeTemplate = { name: string; icon: TablerIcon; prompt: string };

type TemplateId = keyof (typeof homeModeMessages)[Locale]["templates"];

const templateIcons: Record<TemplateId, TablerIcon> = {
  white: IconBackground,
  scene: IconHomeHeart,
  campaign: IconConfetti,
  poster: IconSparkles,
  closeup: IconZoomIn,
  detailSet: IconListDetails,
  sellingPoints: IconBulb,
  sceneSet: IconPlant2,
  angles: IconRotate360,
  showcase: IconCameraRotate,
  mood: IconSunHigh,
  macro: IconZoomIn,
  unboxing: IconPackage,
};

/** 每个模式的非文字设置：上传上限与模板顺序；文字在 home-modes-messages.ts。 */
type ModeSettings = {
  uploadLimit: number;
  templates: TemplateId[];
};

const modeSettings: Record<HomeModeId, ModeSettings> = {
  create: {
    uploadLimit: 5,
    templates: ["white", "scene", "campaign", "poster", "closeup"],
  },
  textile: { uploadLimit: 6, templates: [] },
  variation: {
    uploadLimit: 5,
    templates: ["detailSet", "sellingPoints", "sceneSet", "angles"],
  },
  video: {
    uploadLimit: storyboardOriginalImageLimit,
    templates: ["showcase", "mood", "macro", "unboxing"],
  },
};

function toHomeMode(tool: WorkspaceTool, locale: Locale) {
  const text = homeModeMessages[locale].modes[tool.id];
  const templates = homeModeMessages[locale].templates;
  const settings = modeSettings[tool.id];
  return {
    id: tool.id,
    name: workspaceToolMessages[locale].tools[tool.id].name,
    path: tool.path,
    /** 标语按两段显示，窄屏只在第一段之后换行。 */
    slogan: [text.sloganLead, text.sloganTail],
    /** 标语第二段里用当前模式强调渐变突出的关键词。 */
    sloganHighlight: text.highlight,
    uploadLimit: settings.uploadLimit,
    placeholder: text.placeholder,
    templates: settings.templates.map(
      (id): HomeTemplate => ({ ...templates[id], icon: templateIcons[id] }),
    ),
  } as const;
}

/** 首页各模式按当前语言组装的完整配置，顺序与工作区工具坞一致。 */
export function homeModesFor(locale: Locale) {
  return workspaceTools
    .filter((tool) => tool.id !== "video" && tool.id !== "replica")
    .map((tool) => toHomeMode(tool, locale));
}

/** 首页单个创作模式的完整配置。 */
export type HomeMode = ReturnType<typeof toHomeMode>;

/** 读取地址里的模式参数，缺失或未知时回到主图制作。 */
export function homeModeFor(value: string | null, locale: Locale): HomeMode {
  const tool =
    workspaceTools
      .filter((item) => item.id !== "replica" && item.id !== "video")
      .find((item) => item.id === value) ?? workspaceTools[0];
  return toHomeMode(tool, locale);
}
