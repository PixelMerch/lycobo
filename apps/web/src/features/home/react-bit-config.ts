/** 首页 React Bits 图片背景参数。保存后 Vite 会热更新，无需修改组件或 CSS。 */
export const reactBitConfig = {
  gridMotion: {
    rows: 8, // 行数：越多单张图片越小，建议 4–10
    aspectRatio: 1.4, // Tile Ratio：图片宽高比
    gap: 15, // 图片间距，px
    radius: 12, // 图片圆角，px
    angle: -12, // 整体旋转角度，deg
    tilt: 0, // 透视倾斜角度，0–75
    speed: 24, // 自动移动速度，px/s；0 为停止自动移动
    direction: "alternate", // alternate：错向；left：向左；right：向右
    parallax: 0.5, // 鼠标视差，0–1；0 为关闭
    spotlight: 0.6, // 鼠标附近图片的提亮范围，0–1；0 为关闭
    dim: 0.6, // 图片暗化程度，0–1；越大越暗
    fade: 0.7, // 左右与底部渐隐，0–1；顶部不渐隐，覆盖 Header
    grayscale: false, // 是否使用黑白图片（鼠标附近恢复色彩）
  },
  home: {
    backgroundHeight: 720, // 背景覆盖高度，px
    overlayOpacity: 0.5, // 整体暗色遮罩，0–1；越大越暗
    topSpacing: 120, // 桌面输入区到 Header 的间距，px
    mobileTopSpacing: 72, // 手机输入区到 Header 的间距，px
  },
} as const;
