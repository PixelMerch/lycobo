import { type MotionProps, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

/** Keep the official modal mounted until its centred exit finishes. */
export function useCenteredDialogMotion(onClose: () => void) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"open" | "closed">("open");
  const closing = useRef(false);
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    if (reducedMotion) onClose();
    else setPhase("closed");
  };
  const surfaceMotion: MotionProps = {
    initial: reducedMotion ? false : "closed",
    animate: phase,
    variants: {
      open: { scale: 1, opacity: 1 },
      closed: { scale: 0, opacity: 0 },
    },
    transition: { duration: reducedMotion ? 0 : 0.3, ease: [0.215, 0.61, 0.355, 1] },
    onAnimationComplete: (definition) => {
      if (definition === "closed" && closing.current) onClose();
    },
  };
  return { phase, requestClose, surfaceMotion };
}
