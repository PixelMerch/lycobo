import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

/** Grace period that lets the pointer travel from the trigger into the menu. */
const HOVER_CLOSE_DELAY = 140;

/** Touch devices also emit synthetic mouse events; only real hover surfaces count. */
function isHoverPointer(event: React.PointerEvent) {
  return event.pointerType === "mouse" && window.matchMedia("(hover: hover)").matches;
}

/**
 * Opens a menu when a mouse enters its trigger and closes it once the
 * pointer leaves both the trigger and the menu. Touch and keyboard keep the
 * press/keyboard toggle: pointer events from touch never open on hover, so a
 * tap cannot open and immediately close the menu.
 */
export function useHoverMenu(
  triggerRef: RefObject<HTMLButtonElement | null>,
  itemSelector: string,
  {
    openDelay = 0,
    closeDelay = HOVER_CLOSE_DELAY,
    keepOpenOnHoveredPress = true,
  }: { openDelay?: number; closeDelay?: number; keepOpenOnHoveredPress?: boolean } = {},
) {
  const [isOpen, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const openTimer = useRef<number | null>(null);
  const cancelOpen = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);
  const hoverOpened = useRef(false);
  const pressInside = useRef(false);
  const keyboardOpened = useRef(false);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cancelOpen();
      cancelClose();
    },
    [cancelOpen, cancelClose],
  );

  // A non-modal popover never moves focus by itself, so keyboard opens put the
  // first menu item in the tab order explicitly.
  useEffect(() => {
    if (!isOpen || !keyboardOpened.current) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(itemSelector)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, itemSelector]);

  const scheduleClose = useCallback(() => {
    cancelOpen();
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      hoverOpened.current = false;
      setOpen(false);
    }, closeDelay);
  }, [cancelOpen, cancelClose, closeDelay]);

  const openForHover = (event: React.PointerEvent) => {
    if (!isHoverPointer(event)) return;
    cancelClose();
    if (isOpen || openTimer.current !== null) return;
    const reveal = () => {
      openTimer.current = null;
      hoverOpened.current = true;
      keyboardOpened.current = false;
      setOpen(true);
    };
    if (openDelay === 0) reveal();
    else openTimer.current = window.setTimeout(reveal, openDelay);
  };

  const closeAfterHover = (event: React.PointerEvent) => {
    if (!isHoverPointer(event)) return;
    scheduleClose();
  };

  const close = () => {
    cancelOpen();
    cancelClose();
    hoverOpened.current = false;
    pressInside.current = false;
    keyboardOpened.current = false;
    setOpen(false);
  };

  return {
    isOpen,
    close,
    openFromKeyboard: () => {
      cancelOpen();
      cancelClose();
      hoverOpened.current = false;
      keyboardOpened.current = true;
      setOpen(true);
    },
    onOpenChange: (next: boolean) => {
      cancelOpen();
      cancelClose();
      // A press on an already hovered trigger keeps the menu open instead of
      // toggling it shut under the pointer. Escape and outside presses close.
      if (!next && keepOpenOnHoveredPress && hoverOpened.current && pressInside.current) {
        pressInside.current = false;
        return;
      }
      pressInside.current = false;
      if (!next) hoverOpened.current = false;
      if (!next && keyboardOpened.current) {
        keyboardOpened.current = false;
        triggerRef.current?.focus();
      }
      setOpen(next);
    },
    triggerProps: {
      onPointerEnter: openForHover,
      onPointerLeave: closeAfterHover,
      onPointerDown: () => {
        pressInside.current = hoverOpened.current;
      },
      onKeyDown: (event: React.KeyboardEvent) => {
        if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
          keyboardOpened.current = true;
        }
      },
    },
    popoverProps: {
      onPointerEnter: (event: React.PointerEvent) => {
        if (!isHoverPointer(event)) return;
        cancelClose();
      },
      onPointerLeave: closeAfterHover,
    },
  };
}
