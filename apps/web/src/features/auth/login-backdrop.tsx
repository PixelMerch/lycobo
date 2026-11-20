import { SilkBackground } from "./silk/silk-background";

const silkPalette = { color: "#1f2b14", sheen: "#a8ff00" };

/** 登录页背景：深绿丝绸叠加主题色光泽，不支持 WebGL2 时由 CSS 渐变兜底。 */
export function LoginBackdrop() {
  return (
    <div className="login-backdrop" aria-hidden="true">
      <SilkBackground palette={silkPalette} />
    </div>
  );
}
