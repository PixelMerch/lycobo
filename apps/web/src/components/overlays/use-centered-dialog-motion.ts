import { type MotionProps, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Keep the official modal mounted until its centred exit finishes. */
export function useCenteredDialogMotion(onClose: () => void) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"open" | "closed">("open");
  const closing = useRef(false);
  const finished = useRef(false);
  const finishClose = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onClose();
  }, [onClose]);
  // An interrupted entrance may already have the closed transform, so Motion
  // need not emit another completion. Never leave a closing modal mounted.
  useEffect(() => {
    if (phase !== "closed") return;
    const timer = setTimeout(finishClose, 300);
    return () => clearTimeout(timer);
  }, [phase, finishClose]);
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    if (reducedMotion) finishClose();
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
      if (definition === "closed" && closing.current) finishClose();
    },
  };
  return { phase, requestClose, surfaceMotion };
}
