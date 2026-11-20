import { Button, Input } from "@heroui/react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { UiIcon } from "./ui-icon";
import "./command-button.css";

// 动效参数来自 DesignBookmark Command button（MIT）。
// https://designbookmark.com/motion-src/react/command-button.tsx
const pressSpring = { stiffness: 520, damping: 34, mass: 0.6 };
const openSpring = { type: "spring", stiffness: 300, damping: 28 } as const;
const swap = { duration: 0.18, ease: [0.23, 1, 0.32, 1] } as const;

function contentMotion(active: boolean, reduced: boolean | null) {
  return {
    opacity: active ? 1 : 0,
    filter: active || reduced ? "blur(0px)" : "blur(4px)",
    transition: reduced ? { duration: 0 } : { ...swap, delay: active ? 0.06 : 0 },
  };
}

function isCommandActivation(event: KeyboardEvent, modifier: boolean, key: boolean) {
  const insideDialog = event.target instanceof Element && event.target.closest('[role="dialog"]');
  return (
    event.type === "keydown" &&
    modifier &&
    key &&
    !insideDialog &&
    !event.repeat &&
    !event.defaultPrevented &&
    !event.isComposing &&
    !event.altKey &&
    !event.shiftKey
  );
}

function useCommandKeys(
  root: RefObject<HTMLDivElement | null>,
  open: boolean,
  activate: () => void,
  press: (down: boolean) => void,
) {
  const [apple] = useState(
    () => typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform),
  );
  const [held, setHeld] = useState<"modifier" | "shortcut" | null>(null);
  const handleKeys = useEffectEvent((event: KeyboardEvent) => {
    if (!root.current?.isConnected) return;
    const modifier = apple ? event.metaKey : event.ctrlKey;
    const key = event.code === "KeyK" || event.key.toLowerCase() === "k";
    let next: typeof held = null;
    if (!open && modifier) next = event.type === "keydown" && key ? "shortcut" : "modifier";
    setHeld(next);
    press(!!next);
    if (!isCommandActivation(event, modifier, key)) return;
    event.preventDefault();
    activate();
  });
  const releaseKeys = useEffectEvent(() => {
    setHeld(null);
    press(false);
  });
  useEffect(() => {
    const keys = (event: KeyboardEvent) => handleKeys(event);
    const release = () => releaseKeys();
    window.addEventListener("keydown", keys);
    window.addEventListener("keyup", keys);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", keys);
      window.removeEventListener("keyup", keys);
      window.removeEventListener("blur", release);
    };
  }, []);
  return { apple, held };
}

/** 用按钮或系统快捷键展开就地搜索，收起时恢复键盘焦点。 */
export function CommandButton({
  label,
  placeholder,
  closeLabel,
  query,
  onQueryChange,
}: {
  label: string;
  placeholder: string;
  closeLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const pressTarget = useMotionValue(1);
  const scale = useSpring(pressTarget, pressSpring);
  const hasQuery = !!query.trim();

  function activate() {
    if (open) input.current?.focus({ preventScroll: true });
    else setOpen(true);
  }

  const press = (down: boolean) => pressTarget.set(down && !reduced ? 0.97 : 1);
  const { apple, held } = useCommandKeys(root, open, activate, press);

  function close() {
    restoreFocus.current = true;
    onQueryChange("");
    setOpen(false);
  }

  useLayoutEffect(() => {
    pressTarget.set(1);
    if (open) {
      input.current?.focus({ preventScroll: true });
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
  }, [open, pressTarget]);

  useEffect(() => {
    // 查询有内容时保留可见输入，点击作品不会先清空筛选并改变卡片位置。
    if (!open || hasQuery) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [hasQuery, open]);

  return (
    <motion.div
      ref={root}
      layout
      transition={{ layout: reduced ? { duration: 0 } : openSpring }}
      style={{ scale }}
      className="command-button"
      role="search"
      aria-label={label}
      aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
      data-open={open}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
    >
      <motion.div
        className="command-button-trigger"
        inert={open}
        initial={false}
        animate={contentMotion(!open, reduced)}
      >
        <Button
          ref={trigger}
          type="button"
          variant="tertiary"
          size="sm"
          aria-label={label}
          aria-expanded={open}
          onPress={activate}
          onPressChange={press}
        >
          <UiIcon icon={IconSearch} size="small" />
          <span className="command-button-label">{label}</span>
          <span className="command-button-shortcut" aria-hidden="true">
            <kbd data-held={!!held}>{apple ? "⌘" : "Ctrl"}</kbd>
            <kbd data-held={held === "shortcut"}>K</kbd>
          </span>
        </Button>
      </motion.div>
      <motion.div
        className="command-button-field"
        inert={!open}
        initial={false}
        animate={contentMotion(open, reduced)}
        onBlur={(event) => {
          if (open && !hasQuery && !event.currentTarget.contains(event.relatedTarget))
            setOpen(false);
        }}
      >
        <UiIcon icon={IconSearch} size="small" />
        <Input
          ref={input}
          type="search"
          className="command-button-input"
          aria-label={label}
          placeholder={placeholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="command-button-close"
          aria-label={closeLabel}
          onPress={close}
        >
          <kbd>Esc</kbd>
          <UiIcon icon={IconX} size="small" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
