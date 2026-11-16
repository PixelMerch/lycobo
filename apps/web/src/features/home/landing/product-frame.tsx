export type ProductView = "original" | "studio" | "scene" | "alternate" | "detail" | "base";

/** 用同一商品轮廓预留各画幅，正式图片确认后替换画面。 */
export function ProductFrame({ view, className }: { view: ProductView; className?: string }) {
  return (
    <span className={`commerce-frame ${className ?? ""}`} data-view={view} aria-hidden="true">
      <span className="commerce-frame-product">
        <span className="commerce-frame-lid" />
        <span className="commerce-frame-jar" />
        <span className="commerce-frame-base" />
      </span>
    </span>
  );
}
