import { Button } from "@heroui/react";
import { useLayoutEffect, useRef } from "react";
import { InfiniteLoad } from "../../components/infinite-load";
import { AssetImage } from "../generation/asset-image";
import type { PreviewImage } from "./image-preview";

const railCopy = {
  image: {
    rail: "全部图片",
    item: (position: number) => `预览第 ${position} 张`,
    alt: (position: number) => `第 ${position} 张缩略图`,
  },
  video: {
    rail: "全部视频",
    item: (position: number) => `预览第 ${position} 个视频`,
    alt: (position: number) => `第 ${position} 个视频封面`,
  },
};

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
  kind?: keyof typeof railCopy;
  index: number;
  onSelect: (index: number) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoadMoreError: boolean;
  onLoadMore?: (() => Promise<unknown>) | undefined;
}) {
  const rail = useRef<HTMLElement>(null);
  const copy = railCopy[kind];
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
