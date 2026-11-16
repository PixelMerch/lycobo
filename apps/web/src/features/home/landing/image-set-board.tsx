import { Button } from "@heroui/react";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";

const photos = [
  { view: "lead", image: "worn", label: "full" },
  { view: "zipper", image: "zipper", label: "zipper" },
  { view: "fabric", image: "fabric", label: "fabric" },
  { view: "scene", image: "scene", label: "scene" },
] as const;

/** 穿着、工艺与场景同时呈现，整组打开现有图片浏览器。 */
export function ImageSetBoard({ onOpen }: { onOpen: () => void }) {
  const t = useMessages(commerceShowcaseMessages).set;
  return (
    <Button variant="ghost" className="commerce-set-board" aria-label={t.open} onPress={onOpen}>
      {photos.map(({ view, image, label }) => (
        <span key={view} className={`commerce-set-photo commerce-set-${view}`}>
          <img src={`/landing/commerce/p11-${image}.webp`} alt={t[label]} loading="lazy" />
        </span>
      ))}
    </Button>
  );
}
