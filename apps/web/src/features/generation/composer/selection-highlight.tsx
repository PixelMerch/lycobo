import { motion, useReducedMotion } from "motion/react";

/** Shared layout animation for the selected option background. */
export function SelectionHighlight({
  layoutId,
  layoutDependency,
}: {
  layoutId: string;
  layoutDependency?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <span aria-hidden="true" className="toggle-selection" />;
  return (
    <motion.span
      aria-hidden="true"
      className="toggle-selection"
      layoutId={layoutId}
      layoutDependency={layoutDependency}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    />
  );
}
