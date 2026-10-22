import { Button } from "@heroui/react";
import { useLayoutEffect, useRef } from "react";
import { assetContentUrl } from "./generation-client";
import type { PreviewImage } from "./image-preview";

export function ImagePreviewRail({
  images,
  index,
  onSelect,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  images: PreviewImage[];
  index: number;
  onSelect: (index: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore?: (() => void) | undefined;
}) {
  const rail = useRef<HTMLElement>(null);
  const activeId = images[index]?.id;
  useLayoutEffect(() => {
    const element = rail.current;
    if (!element || !activeId) return;
    const reveal = () => {
      const thumb = element.querySelector<HTMLElement>('[aria-current="true"]');
      if (!thumb || !element.clientHeight) return;
      // Layout offsets remain accurate during the dialog's opening scale animation.
      if (thumb.offsetTop < element.scrollTop) element.scrollTop = thumb.offsetTop;
      else if (thumb.offsetTop + thumb.offsetHeight > element.scrollTop + element.clientHeight)
        element.scrollTop = thumb.offsetTop + thumb.offsetHeight - element.clientHeight;
      if (thumb.offsetLeft < element.scrollLeft) element.scrollLeft = thumb.offsetLeft;
      else if (thumb.offsetLeft + thumb.offsetWidth > element.scrollLeft + element.clientWidth)
        element.scrollLeft = thumb.offsetLeft + thumb.offsetWidth - element.clientWidth;
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(element);
    return () => resize.disconnect();
  }, [activeId]);
  return (
    <nav className="image-preview-rail" aria-label="全部图片" ref={rail}>
      {images.map((image, position) => (
        <Button
          key={image.id}
          variant="tertiary"
          className="history-thumbnail image-preview-thumb"
          aria-label={`预览第 ${position + 1} 张`}
          aria-current={position === index ? "true" : "false"}
          onPress={() => onSelect(position)}
        >
          <img
            src={assetContentUrl(image.id, true)}
            alt={`第 ${position + 1} 张缩略图`}
            loading="lazy"
          />
        </Button>
      ))}
      {hasMore && (
        <Button
          variant="tertiary"
          size="sm"
          className="image-preview-load-more"
          isDisabled={isLoadingMore}
          onPress={() => onLoadMore?.()}
        >
          加载更多图片
        </Button>
      )}
    </nav>
  );
}
