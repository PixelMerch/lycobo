import { Button } from "@heroui/react";
import { useLayoutEffect, useRef } from "react";
import { InfiniteLoad } from "../../components/infinite-load";
import { useMessages } from "../../i18n/messages";
import { AssetImage } from "../generation/asset-image";
import type { PreviewImage } from "./image-preview";
import { imageWorkspaceMessages } from "./image-workspace-messages";

function revealRailThumb(element: HTMLElement, thumb: HTMLElement) {
  // Layout offsets remain accurate during the dialog's opening scale animation.
  if (thumb.offsetTop < element.scrollTop) element.scrollTop = thumb.offsetTop;
  else if (thumb.offsetTop + thumb.offsetHeight > element.scrollTop + element.clientHeight)
    element.scrollTop = thumb.offsetTop + thumb.offsetHeight - element.clientHeight;
  if (thumb.offsetLeft < element.scrollLeft) element.scrollLeft = thumb.offsetLeft;
  else if (thumb.offsetLeft + thumb.offsetWidth > element.scrollLeft + element.clientWidth)
    element.scrollLeft = thumb.offsetLeft + thumb.offsetWidth - element.clientWidth;
}

/** 图片预览左侧的缩略图栏：同组图片或视频，选中项保持在可视范围内。 */
export function ImagePreviewRail({
  images,
  kind = "image",
  index,
  onSelect,
  hasMore,
  isLoadingMore,
  isLoadMoreError,
  onLoadMore,
}: {
  images: Pick<PreviewImage, "id">[];
  kind?: "image" | "video";
  index: number;
  onSelect: (index: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoadMoreError: boolean;
  onLoadMore?: (() => Promise<unknown>) | undefined;
}) {
  const rail = useRef<HTMLElement>(null);
  const copy = useMessages(imageWorkspaceMessages).rail[kind];
  const activeId = images[index]?.id;
  useLayoutEffect(() => {
    const element = rail.current;
    if (!element || !activeId) return;
    const reveal = () => {
      const thumb = element.querySelector<HTMLElement>('[aria-current="true"]');
      if (!thumb || !element.clientHeight) return;
      revealRailThumb(element, thumb);
    };
    reveal();
    const resize = new ResizeObserver(reveal);
    resize.observe(element);
    return () => resize.disconnect();
  }, [activeId]);
  return (
    <nav className="image-preview-rail" aria-label={copy.rail} ref={rail}>
      {images.map((image, position) => (
        <Button
          key={image.id}
          variant="tertiary"
          className="history-thumbnail image-preview-thumb"
          aria-label={copy.item(position + 1)}
          aria-current={position === index ? "true" : "false"}
          onPress={() => onSelect(position)}
        >
          <span className="history-thumbnail-frame">
            <AssetImage assetId={image.id} thumbnail alt={copy.alt(position + 1)} loading="lazy" />
          </span>
        </Button>
      ))}
      <InfiniteLoad
        hasMore={hasMore && Boolean(onLoadMore)}
        isLoading={isLoadingMore}
        isError={isLoadMoreError}
        onLoadMore={() => onLoadMore?.()}
      />
    </nav>
  );
}
