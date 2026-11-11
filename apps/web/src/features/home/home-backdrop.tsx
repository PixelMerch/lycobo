import type { Ref } from "react";
import type { HomeModeId } from "./home-modes";
import { SilkBackground, type SilkHandle, type SilkPalette } from "./silk/silk-background";

// 每个模式一种丝绸：底色取工具强调色的深色调，光泽用强调色本身。
const palettes: Record<HomeModeId, SilkPalette> = {
  create: { color: "#22380A", sheen: "#9BE622" },
  textile: { color: "#4D2C17", sheen: "#FFB27A" },
  variation: { color: "#0F3D31", sheen: "#4FE3B0" },
  video: { color: "#123251", sheen: "#7CC4FF" },
};

/** 首页首屏背景：静态渐变打底，上面铺随模式换色的丝绸；切换页签时由页面触发涟漪。 */
export function HomeBackdrop({ modeId, ref }: { modeId: HomeModeId; ref: Ref<SilkHandle> }) {
  return (
    <div className="home-atmosphere" aria-hidden="true">
      <SilkBackground palette={palettes[modeId]} ref={ref} />
    </div>
  );
}
