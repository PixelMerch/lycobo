import { publicImageUrl } from "../../../lib/public-image-url";

/** 家纺主图生成工具共用的拍摄角度。 */
export { type TextileViewId, textileViews } from "@lycoboai/contracts";

import type { TextileViewId } from "@lycoboai/contracts";

/** 用静态示例展示角度，生成任务只接收用户选择的参考图。 */
export const textileViewImages = {
  "overhead-wide": publicImageUrl("/studio/textile-views/overhead-wide.webp"),
  "overhead-close": publicImageUrl("/studio/textile-views/overhead-close.webp"),
  "close-up": publicImageUrl("/studio/textile-views/close-up.webp"),
  pillow: publicImageUrl("/studio/textile-views/pillow.webp"),
  "bed-end": publicImageUrl("/studio/textile-views/bed-end.webp"),
  "angled-overhead": publicImageUrl("/studio/textile-views/angled-overhead.webp"),
  front: publicImageUrl("/studio/textile-views/front.webp"),
  "angled-level": publicImageUrl("/studio/textile-views/angled-level.webp"),
  draped: publicImageUrl("/studio/textile-views/draped.webp"),
  fabric: publicImageUrl("/studio/textile-views/fabric.webp"),
} satisfies Record<TextileViewId, string>;
