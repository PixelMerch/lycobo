import { Button, Label, Popover, TextArea, TextField } from "@heroui/react";
import { type RefObject, useId, useLayoutEffect, useRef, useState } from "react";
import { ReferenceMentionOptions } from "../features/generation/references/reference-mention-options";
import type { ReferenceImage } from "../features/generation/studio-state";
import "./reference-prompt.css";
import "./studio-control-feedback.css";

/** Serialize chips back to the existing plain-text prompt contract. */
function readPrompt(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLElement) {
    if (node.dataset.reference) return node.dataset.reference;
    if (node.tagName === "BR") return "\n";
  }
  return Array.from(node.childNodes, (child, index) => {
    const block = child instanceof HTMLElement && ["DIV", "P"].includes(child.tagName);
    const text = readPrompt(child);
    return block && index > 0 ? `\n${text === "\n" ? "" : text}` : text;
  }).join("");
}
function selectionOffset(editor: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode))
    return 0;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return readPrompt(range.cloneContents()).length;
}
function placeCursor(editor: HTMLElement, offset: number) {
  editor.focus();
  const range = document.createRange();
  let remaining = offset;
  function visit(parent: Node): boolean {
    for (const node of parent.childNodes) {
      const length = readPrompt(node).length;
      if (node instanceof HTMLElement && node.dataset.reference) {
        if (remaining <= length) {
          if (remaining === 0) range.setStartBefore(node);
          else range.setStartAfter(node);
          return true;
        }
      } else if (node.nodeType === Node.TEXT_NODE && remaining <= length) {
        range.setStart(node, remaining);
        return true;
      } else if (remaining < length && visit(node)) return true;
      remaining -= length;
    }
    return false;
  }
  if (!visit(editor)) {
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

const autoGrowMinHeight = 100;
function useAutoGrow(ref: RefObject<HTMLElement | null>, value: string, enabled: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    let width = -1;
    const fit = () => {
      element.style.height = "auto";
      const contentHeight = value.length ? element.scrollHeight : autoGrowMinHeight;
      element.style.height = `${Math.max(contentHeight, autoGrowMinHeight)}px`;
      element.style.overflowY = "hidden";
    };
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(next - width) < 1) return;
      width = next;
      fit();
    });
    fit();
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.style.removeProperty("height");
      element.style.removeProperty("overflow-y");
    };
  }, [enabled, ref, value]);
}

/** Mentions refer to the current ordered reference list; no files are uploaded here. */
export function ReferencePrompt({
  value,
  onChange,
  references,
  className,
  label,
  placeholder,
  inputRef,
  maxLength = 9000,
  showCount = false,
  autoGrow = false,
  onReferencesInsert,
}: {
  value: string;
  onChange: (value: string) => void;
  references: readonly { id: string; src: string; name?: string; assetId?: string }[];
  className: string;
  label?: string;
  placeholder: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  maxLength?: number;
  showCount?: boolean;
  autoGrow?: boolean;
  onReferencesInsert?: (images: ReferenceImage[], prompt: string) => void;
}) {
  const countId = useId();
  const composing = useRef(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;
  const richRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(0);
  const focusPending = useRef(false);
  const parts = Array.from(value.matchAll(/@图片[1-9]\d*|[^@]+|@/g), (match) => match[0]);
  const validReference = (text: string) =>
    /^@图片[1-9]\d*$/.test(text) && Number(text.slice(3)) <= references.length;
  const hasReferences = value.includes("@");
  const mentionAnchor = useRef<HTMLElement | null>(null);
  const [anchoredMention, setAnchoredMention] = useState<number | null>(null);
  useLayoutEffect(() => {
    const editor = richRef.current;
    if (editor) {
      const tokens = parts.filter(validReference);
      const chips = Array.from(editor.querySelectorAll<HTMLElement>("[data-reference]"));
      const sameChips =
        tokens.length === chips.length &&
        chips.every((chip, index) => {
          const image = references[Number(tokens[index]?.slice(3)) - 1];
          return chip.dataset.reference === tokens[index] && chip.dataset.imageId === image?.id;
        });
      let textOffset = 0;
      const plainMentions: number[] = [];
      for (const text of parts) {
        if (text === "@") plainMentions.push(textOffset);
        textOffset += text.length;
      }
      const atSigns = Array.from(editor.querySelectorAll<HTMLElement>(".reference-at"));
      const sameAtSigns =
        atSigns.length === plainMentions.length &&
        atSigns.every(
          (at, index) =>
            at.textContent === "@" && Number(at.dataset.mentionStart) === plainMentions[index],
        );
      if (readPrompt(editor) !== value || !sameChips || !sameAtSigns) {
        const focused = document.activeElement === editor;
        const cursor = focused ? selectionOffset(editor) : cursorRef.current;
        const fragment = document.createDocumentFragment();
        let offset = 0;
        for (const text of parts) {
          const start = offset;
          offset += text.length;
          if (text === "@") {
            const at = document.createElement("span");
            at.className = "reference-at";
            at.dataset.mentionStart = String(start);
            at.textContent = text;
            fragment.append(at);
            continue;
          }
          const image = validReference(text) ? references[Number(text.slice(3)) - 1] : undefined;
          if (!image) {
            fragment.append(document.createTextNode(text));
            continue;
          }
          const chip = document.createElement("span");
          chip.className = "reference-prompt-chip";
          chip.contentEditable = "false";
          chip.dataset.reference = text;
          chip.dataset.imageId = image.id;
          const thumbnail = document.createElement("img");
          thumbnail.src = image.src;
          thumbnail.alt = "";
          const name = document.createElement("span");
          name.textContent = text.slice(1);
          chip.append(thumbnail, name);
          fragment.append(chip);
        }
        editor.replaceChildren(fragment);
        if (focused || focusPending.current) placeCursor(editor, cursor);
      }
    }
    if (focusPending.current) {
      const offset = cursorRef.current;
      if (editor) placeCursor(editor, offset);
      else {
        ref.current?.focus();
        ref.current?.setSelectionRange(offset, offset);
      }
      focusPending.current = false;
      // The mention popover restores focus when it closes; re-apply the caret
      // afterwards so the caret stays in the prompt, after the inserted chip.
      requestAnimationFrame(() => {
        const current = richRef.current;
        if (current) placeCursor(current, offset);
        else {
          ref.current?.focus();
          ref.current?.setSelectionRange(offset, offset);
        }
      });
    }
  });
  useAutoGrow(richRef, value, autoGrow && hasReferences);
  useAutoGrow(ref, value, autoGrow && !hasReferences);
  const [mention, setMention] = useState<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    mentionAnchor.current =
      mention && value[mention.start] === "@"
        ? (richRef.current?.querySelector<HTMLElement>(`[data-mention-start="${mention.start}"]`) ??
          null)
        : null;
    setAnchoredMention(mentionAnchor.current && mention ? mention.start : null);
  }, [mention, value]);
  function detect(text: string, cursor: number) {
    cursorRef.current = cursor;
    if (text[cursor - 1] === "@") {
      focusPending.current = true;
      setMention({ start: cursor - 1, end: cursor });
    }
  }
  function handleRichInput() {
    const editor = richRef.current;
    if (!editor) return;
    const text = readPrompt(editor).slice(0, maxLength);
    const cursor = selectionOffset(editor);
    cursorRef.current = cursor;
    focusPending.current = !composing.current;
    onChange(text);
    if (!composing.current) detect(text, cursor);
  }
  function clear() {
    onChange("");
    cursorRef.current = 0;
    setMention(null);
    requestAnimationFrame(() => {
      const editor = richRef.current;
      if (editor) {
        editor.focus();
        placeCursor(editor, 0);
      } else {
        ref.current?.focus();
        ref.current?.setSelectionRange(0, 0);
      }
    });
  }
  const usedIds = new Set(
    parts.filter(validReference).flatMap((token) => {
      const image = references[Number(token.slice(3)) - 1];
      return image ? [image.id, ...(image.assetId ? [image.assetId] : [])] : [];
    }),
  );
  function insert(images: ReferenceImage[]) {
    if (!mention || value[mention.start] !== "@") return;
    const nextReferences = [...references];
    const added: ReferenceImage[] = [];
    const inserted = new Set(usedIds);
    const tokens: string[] = [];
    for (const image of images) {
      if (inserted.has(image.id) || (image.assetId && inserted.has(image.assetId))) continue;
      let index = nextReferences.findIndex(
        (reference) =>
          reference.id === image.id || (image.assetId && reference.assetId === image.assetId),
      );
      if (index < 0) {
        if (!onReferencesInsert || nextReferences.length >= 5) continue;
        index = nextReferences.length;
        nextReferences.push(image);
        added.push(image);
      }
      inserted.add(image.id);
      if (image.assetId) inserted.add(image.assetId);
      tokens.push(`@图片${index + 1}`);
    }
    if (!tokens.length) return;
    const text = `${tokens.join(" ")} `;
    const next = value.slice(0, mention.start) + text + value.slice(mention.end);
    if (next.length > maxLength) return;
    cursorRef.current = mention.start + text.length;
    focusPending.current = true;
    if (added.length) onReferencesInsert?.(added, next);
    else onChange(next);
    setMention(null);
  }
  return (
    <>
      <TextField className={className} {...(label ? {} : { "aria-label": "创作需求" })}>
        {label && <Label>{label}</Label>}
        <div
          className="prompt-editor"
          data-count={showCount ? "" : undefined}
          data-auto-grow={autoGrow ? "" : undefined}
        >
          {hasReferences ? (
            // biome-ignore lint/a11y/useSemanticElements: Native contenteditable is required for atomic image chips, which a textarea cannot render.
            <div
              ref={richRef}
              role="textbox"
              tabIndex={0}
              aria-label={label ?? "创作需求"}
              aria-multiline="true"
              aria-describedby={showCount ? countId : undefined}
              contentEditable
              suppressContentEditableWarning
              className="textarea reference-rich-editor"
              data-auto-grow={autoGrow ? "" : undefined}
              onInput={handleRichInput}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
                handleRichInput();
              }}
              onCopy={(event) => {
                const selection = window.getSelection();
                if (!selection?.rangeCount) return;
                event.preventDefault();
                event.clipboardData.setData(
                  "text/plain",
                  readPrompt(selection.getRangeAt(0).cloneContents()),
                );
              }}
              onCut={(event) => {
                const editor = richRef.current;
                const selection = window.getSelection();
                if (!editor || !selection?.rangeCount) return;
                const range = selection.getRangeAt(0);
                if (!editor.contains(range.commonAncestorContainer)) return;
                event.preventDefault();
                event.clipboardData.setData("text/plain", readPrompt(range.cloneContents()));
                range.deleteContents();
                handleRichInput();
              }}
              onPaste={(event) => {
                event.preventDefault();
                const editor = richRef.current;
                const selection = window.getSelection();
                if (!editor || !selection?.rangeCount) return;
                const range = selection.getRangeAt(0);
                if (!editor.contains(range.commonAncestorContainer)) return;
                const text = event.clipboardData
                  .getData("text/plain")
                  .slice(
                    0,
                    Math.max(
                      0,
                      maxLength - value.length + readPrompt(range.cloneContents()).length,
                    ),
                  );
                range.deleteContents();
                const node = document.createTextNode(text);
                range.insertNode(node);
                range.setStartAfter(node);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                handleRichInput();
              }}
            />
          ) : (
            <TextArea
              ref={ref}
              aria-label={label ? undefined : "创作需求"}
              aria-describedby={showCount ? countId : undefined}
              value={value}
              onChange={(event) => {
                const next = event.target.value.slice(0, maxLength);
                const cursor = Math.min(event.currentTarget.selectionStart, next.length);
                cursorRef.current = cursor;
                onChange(next);
                if (!composing.current) detect(next, cursor);
              }}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={(event) => {
                composing.current = false;
                detect(event.currentTarget.value, event.currentTarget.selectionStart);
              }}
              placeholder={placeholder}
              maxLength={maxLength}
              data-auto-grow={autoGrow ? "" : undefined}
            />
          )}
          {showCount && (
            <div className="prompt-meta">
              {value.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="prompt-clear"
                  aria-label="清空提示词"
                  onPress={clear}
                >
                  清空
                </Button>
              )}
              <span id={countId} className="prompt-count">
                {value.length}/{maxLength}
              </span>
            </div>
          )}
        </div>
      </TextField>
      <Popover
        isOpen={mention !== null && anchoredMention === mention.start}
        onOpenChange={(open) => {
          if (!open) setMention(null);
        }}
      >
        <Popover.Content
          triggerRef={mentionAnchor}
          placement="bottom start"
          shouldFlip={false}
          offset={8}
          className="reference-mention-popover"
        >
          <Popover.Dialog aria-label="引用图片">
            {mention && (
              <ReferenceMentionOptions
                references={references}
                usedIds={usedIds}
                onSelect={insert}
                allowHistory={Boolean(onReferencesInsert)}
              />
            )}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </>
  );
}
