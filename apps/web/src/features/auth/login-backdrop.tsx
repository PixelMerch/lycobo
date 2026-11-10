import { SilkBackground } from "../home/silk/silk-background";

// 登录页沿用首页“主图制作”的青柠丝绸配色。
const silkPalette = { color: "#22380A", sheen: "#9BE622" };

/** 登录页背景：青柠丝绸铺满全屏，不支持 WebGL2 时由 CSS 渐变兜底。 */
export function LoginBackdrop() {
  return (
    <div className="login-backdrop" aria-hidden="true">
      <SilkBackground palette={silkPalette} />
    </div>
  );
}
