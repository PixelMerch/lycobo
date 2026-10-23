/** Example artwork is intentionally absent; add reviewed image paths here later. */
export const textileViews = [
  { id: "overhead-wide", name: "俯拍全景", description: "从上方展示整张床与完整套件" },
  { id: "overhead-close", name: "俯拍近景", description: "从上方靠近拍摄被面与枕套" },
  { id: "close-up", name: "近距离特写", description: "靠近展示床品纹理与局部细节" },
  { id: "pillow", name: "枕头特写", description: "突出枕套的花型、边缘与质感" },
  { id: "bed-end", name: "床尾特写", description: "展示床尾垂坠与被角细节" },
  { id: "angled-overhead", name: "45度角俯拍", description: "从斜上方展示床品整体层次" },
  { id: "front", name: "正面", description: "正面平视展示床品完整外观" },
  { id: "angled-level", name: "45度角平拍", description: "从侧前方平视展示床品立体感" },
  { id: "draped", name: "被子拖地", description: "展示被子自然垂落至地面的效果" },
  { id: "fabric", name: "面料特写", description: "放大展示面料织纹、花型与工艺" },
] as const;
export type TextileViewId = (typeof textileViews)[number]["id"];
