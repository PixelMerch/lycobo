/** Camera angles for the home-textile main-image variations tool. */
export { type TextileViewId, textileViews } from "@lycoboai/contracts";

import type { TextileViewId } from "@lycoboai/contracts";

/** Static AI-generated examples only; never submitted as user reference images. */
export const textileViewImages = {
  "overhead-wide": "/studio/textile-views/overhead-wide.webp",
  "overhead-close": "/studio/textile-views/overhead-close.webp",
  "close-up": "/studio/textile-views/close-up.webp",
  pillow: "/studio/textile-views/pillow.webp",
  "bed-end": "/studio/textile-views/bed-end.webp",
  "angled-overhead": "/studio/textile-views/angled-overhead.webp",
  front: "/studio/textile-views/front.webp",
  "angled-level": "/studio/textile-views/angled-level.webp",
  draped: "/studio/textile-views/draped.webp",
  fabric: "/studio/textile-views/fabric.webp",
} satisfies Record<TextileViewId, string>;
