import type { ReactNode, SyntheticEvent } from "react";
import { create } from "zustand";
import { useEnterpriseSession } from "./auth-client";

/** One login request is shared by homepage actions and the application shell. */
export const useLoginPrompt = create<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
}>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export function useRequireLogin() {
  const session = useEnterpriseSession();
  const open = useLoginPrompt((state) => state.open);
  return () => {
    if (session.data) return true;
    open();
    return false;
  };
}

/** Preserve the composer preview while gating pointer, keyboard, paste and file-drop edits. */
export function LoginRequiredInteraction({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const session = useEnterpriseSession();
  const open = useLoginPrompt((state) => state.open);
  const block = (event: SyntheticEvent) => {
    if (session.data) return;
    event.preventDefault();
    event.stopPropagation();
    open();
  };
  return (
    <div
      className={className}
      onPointerDownCapture={block}
      onClickCapture={block}
      onKeyDownCapture={(event) => {
        if (event.key !== "Tab" && event.key !== "Shift" && event.key !== "Escape") block(event);
      }}
      onBeforeInputCapture={block}
      onPasteCapture={block}
      onDropCapture={block}
      onDragOverCapture={(event) => {
        if (!session.data) event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
