import type { ClipboardEvent, RefObject } from "react";
import { readPrompt } from "./reference-prompt-dom";

export function RichReferencePrompt({
  editorRef,
  label,
  isRequired,
  countId,
  autoGrow,
  busy,
  maxLength,
  value,
  composing,
  handleRichInput,
  noteTextPaste,
}: {
  editorRef: RefObject<HTMLDivElement | null>;
  label: string | undefined;
  isRequired: boolean;
  countId: string | undefined;
  autoGrow: boolean;
  busy: boolean;
  maxLength: number;
  value: string;
  composing: RefObject<boolean>;
  handleRichInput: () => void;
  noteTextPaste: (text: string) => void;
}) {
  function pasteText(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (busy || !editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const text = event.clipboardData
      .getData("text/plain")
      .slice(0, Math.max(0, maxLength - value.length + readPrompt(range.cloneContents()).length));
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    handleRichInput();
    noteTextPaste(text);
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: Native contenteditable is required for atomic image chips, which a textarea cannot render.
    <div
      ref={editorRef}
      role="textbox"
      tabIndex={0}
      aria-label={label ?? "创作需求"}
      aria-multiline="true"
      aria-required={isRequired || undefined}
      aria-describedby={countId}
      aria-busy={busy || undefined}
      contentEditable={!busy}
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
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return;
        event.preventDefault();
        event.clipboardData.setData("text/plain", readPrompt(range.cloneContents()));
        range.deleteContents();
        handleRichInput();
      }}
      onPaste={pasteText}
    />
  );
}
