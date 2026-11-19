import { SilkBackground } from "./silk/silk-background";

const silkPalette = { color: "#2b1643", sheen: "#a855f7" };

/** 登录页背景：紫色丝绸铺满全屏，不支持 WebGL2 时由 CSS 渐变兜底。 */
export function LoginBackdrop() {
  return (
    <div className="login-backdrop" aria-hidden="true">
      <SilkBackground palette={silkPalette} />
    </div>
  );
}
