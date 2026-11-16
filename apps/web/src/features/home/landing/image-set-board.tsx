import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { ProductFrame, type ProductView } from "./product-frame";

/** 用相邻缩略图切换同款套图的主画面。 */
export function ImageSetBoard({
  views,
  labels,
  chooseLabel,
}: {
  views: readonly [ProductView, ...ProductView[]];
  labels: Record<ProductView, string>;
  chooseLabel: string;
}) {
  const [selected, setSelected] = useState<ProductView>(views[0]);

  return (
    <div className="commerce-set-board">
      <figure className="commerce-set-figure">
        <ProductFrame view={selected} />
        <figcaption>{labels[selected]}</figcaption>
      </figure>
      <ToggleButtonGroup
        className="commerce-set-views"
        aria-label={chooseLabel}
        isDetached
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selected]}
        onSelectionChange={(keys) => {
          const view = views.find((item) => keys.has(item));
          if (view) setSelected(view);
        }}
      >
        {views.map((view) => (
          <ToggleButton className="commerce-set-view" key={view} id={view}>
            <ProductFrame view={view} />
            <span>{labels[view]}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
