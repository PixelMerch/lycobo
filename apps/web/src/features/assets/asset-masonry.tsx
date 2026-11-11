import type { ImageAsset } from "@lycoboai/contracts";
import { type CSSProperties, useLayoutEffect, useState } from "react";
import { aspectRatio, assetColumns, masonryPositions } from "./asset-layout";
import type { AssetSelection } from "./asset-selection";
import { AssetTile } from "./asset-tile";

/**
 * 素材瀑布流：列数随素材区宽度变化（1920 屏 6 列、1440 屏 5 列、手机 2 列），用明确的网格位置
 * 保持 DOM 顺序，分页追加素材时已显示的不移动。
 */
export function AssetMasonry({
  assets,
  showUploadTag,
  selection,
  unavailable,
  onOpen,
  onUnavailable,
}: {
  assets: ImageAsset[];
  showUploadTag: boolean;
  selection: AssetSelection;
  /** 缩略图加载失败的素材：不能下载，也不能被选中。 */
  unavailable: ReadonlySet<string>;
  onOpen: (asset: ImageAsset) => void;
  onUnavailable: (asset: ImageAsset) => void;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState({ width: 0, gap: 12 });
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const next = {
        width: element.getBoundingClientRect().width,
        gap: Number.parseFloat(getComputedStyle(element).columnGap) || 0,
      };
      setGeometry((current) =>
        current.width === next.width && current.gap === next.gap ? current : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  const columns = assetColumns(geometry.width);
  const positions = masonryPositions(assets, geometry.width, columns, geometry.gap);
  const style: CSSProperties & { "--asset-columns": number } = { "--asset-columns": columns };
  return (
    <div className="asset-grid" style={style} ref={setElement}>
      {assets.map((asset, index) => {
        const position = positions[index];
        return (
          <AssetTile
            key={asset.id}
            asset={asset}
            showUploadTag={showUploadTag}
            unavailable={unavailable.has(asset.id)}
            onUnavailable={() => onUnavailable(asset)}
            selection={{
              selecting: selection.selecting,
              selected: selection.selected.has(asset.id),
              onSelect: () =>
                selection.selecting ? selection.toggle(asset.id) : selection.start(asset.id),
            }}
            style={{
              aspectRatio: aspectRatio(asset),
              gridColumn: position?.column,
              gridRow: position ? `${position.row} / span ${position.span}` : undefined,
              height: position?.height,
            }}
            onOpen={() => onOpen(asset)}
          />
        );
      })}
    </div>
  );
}
