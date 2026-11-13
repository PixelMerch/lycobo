/**
 * Gradient Waves 背景参数。
 * 位置优先调 focusX / focusY：0 表示屏幕最左／最上，0.5 居中，1 表示最右／最下。
 * 修改这里即可移动丝绸光带和高光，不需要改着色器。
 */
export const gradientWavesConfig = {
  /** 横向焦点：越小，丝绸越靠左。 */
  focusX: 0.08,
  /** 纵向焦点：越小，丝绸越靠上。 */
  focusY: 0.08,
  /** 光波流动速度：越大越快，越小越平缓。 */
  speed: 0.32,
  /** 像素比上限，移动端和低性能设备可降到 1。 */
  dprLimit: 1.5,
  /** 桌面画质；low 更省性能，high 更细腻。 */
  qualityDesktop: "medium" as const,
  /** 手机画质；默认低一档。 */
  qualityMobile: "low" as const,
  /** 波峰高度：越大起伏越明显，想更平缓先调小这个。 */
  amplitude: 2,
  /** 波形宽度：越小褶皱越宽、越平滑。 */
  waveScale: 0.55,
  waveRatio: 0.82,
  /** 大尺度起伏和细碎横向扰动：越大越晃、越碎。 */
  swell: 30,
  turbulence: 18,
  height: 5.5,
  /** 镜头俯仰角和缩放，影响波带在画面中的占比。 */
  tilt: 64,
  zoom: 1.02,
  fogDepth: 15,
  /** 亮度、透明度、颗粒和光泽。 */
  brightness: 1.08,
  opacity: 1,
  grain: 0.06,
  relief: 0.85,
  sheen: 0.35,
  /** 光源角度，影响亮面落在丝绸的哪一侧。 */
  lightAngle: 120,
  /** 深色雾、波身与波峰颜色，使用 0–1 的 RGB。 */
  horizon: [0.03, 0.09, 0.02],
  wave: [0.22, 0.5, 0.09],
  crest: [0.8, 1, 0.55],
};
