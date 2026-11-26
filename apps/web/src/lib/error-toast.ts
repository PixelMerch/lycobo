import { useEffect, useRef } from "react";
import { toast } from "./toast";

/**
 * Surfaces a request failure once as a top danger toast.
 * Pages keep such errors out of the layout, so the same message never stacks
 * into repeated toasts while a query stays in its error state.
 */
export function useErrorToast(message: string | null | undefined) {
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!message) {
      shown.current = null;
      return;
    }
    if (shown.current === message) return;
    shown.current = message;
    toast.danger(message);
  }, [message]);
}
