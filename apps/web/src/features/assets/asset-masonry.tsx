import type { ImageAsset } from "@lycoboai/contracts";
import { type CSSProperties, useLayoutEffect, useState } from "react";
import { modelDisplayName } from "../generation/models/model-display-name";
import type { useModelPresentation } from "../generation/models/model-logos";
import { aspectRatio, masonryPositions } from "./asset-layout";
import { AssetTile } from "./asset-tile";

/** Explicit grid positions preserve DOM order, including when pagination appends assets. */
export function AssetMasonry({
  assets,
  columns,
  models,
  onOpen,
}: {
  assets: ImageAsset[];
  columns: number;
  models: NonNullable<ReturnType<typeof useModelPresentation>["data"]>["models"];
  onOpen: (asset: ImageAsset) => void;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState({ width: 0, columns, gap: 12 });
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const css = getComputedStyle(element);
      const next = {
        width: element.getBoundingClientRect().width,
        columns: Number.parseInt(css.getPropertyValue("--asset-layout-columns"), 10) || columns,
        gap: Number.parseFloat(css.columnGap) || 0,
      };
      setGeometry((current) =>
        current.width === next.width && current.columns === next.columns && current.gap === next.gap
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [element, columns]);
  const positions = masonryPositions(assets, geometry.width, geometry.columns, geometry.gap);
  const style: CSSProperties & { "--asset-columns": number } = { "--asset-columns": columns };
  return (
    <div className="asset-density-grid" style={style} ref={setElement}>
      {assets.map((asset, index) => {
        const position = positions[index];
        return (
          <AssetTile
            key={asset.id}
            asset={asset}
            modelName={modelDisplayName(asset.model, models)}
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
