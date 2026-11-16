import { motion } from "motion/react";
import { useRef } from "react";
import { ProductFrame, type ProductView } from "./product-frame";
import { useCommerceScrollReveal } from "./use-commerce-scroll-reveal";

/** 主图与同款局部同时陈列，滚动即可看到所有画面。 */
export function ImageSetBoard({
  views,
  labels,
}: {
  views: readonly ProductView[];
  labels: Record<ProductView, string>;
}) {
  const board = useRef<HTMLDivElement>(null);
  const reveal = useCommerceScrollReveal(board, 78, 0.95, "center center");

  return (
    <motion.div ref={board} className="commerce-set-board" style={reveal}>
      {views.map((view) => (
        <figure key={view}>
          <ProductFrame view={view} />
          <figcaption>{labels[view]}</figcaption>
        </figure>
      ))}
    </motion.div>
  );
}
