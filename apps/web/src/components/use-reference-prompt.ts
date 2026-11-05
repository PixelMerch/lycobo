import {
  type ChangeEvent,
  type CompositionEvent,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReferenceImage } from "../features/generation/studio-state";
import {
  focusPrompt,
  type PromptReference,
  readPrompt,
  referenceFor,
  selectionOffset,
  synchronizePrompt,
} from "./reference-prompt-dom";
import { useAutoGrow } from "./use-prompt-auto-grow";

function buildMentionInsert(
  images: ReferenceImage[],
  references: readonly PromptReference[],
  usedIds: Set<string>,
  maxReferences: number,
  allowNew: boolean,
) {
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
      if (!allowNew || nextReferences.length >= maxReferences) continue;
      index = nextReferences.length;
      nextReferences.push(image);
      added.push(image);
    }
    inserted.add(image.id);
    if (image.assetId) inserted.add(image.assetId);
    tokens.push(`@图片${index + 1}`);
  }
  return { added, tokens };
}

function useControlledPrompt({
  richRef,
  ref,
  value,
  parts,
  references,
  cursorRef,
  focusPending,
}: {
  richRef: RefObject<HTMLDivElement | null>;
  ref: RefObject<HTMLTextAreaElement | null>;
  value: string;
  parts: string[];
  references: readonly PromptReference[];
  cursorRef: RefObject<number>;
  focusPending: RefObject<boolean>;
}) {
  useLayoutEffect(() => {
    const editor = richRef.current;
    if (editor)
      synchronizePrompt(editor, value, parts, references, cursorRef.current, focusPending.current);
    if (!focusPending.current) return;
    const offset = cursorRef.current;
    focusPrompt(editor, ref.current, offset);
    focusPending.current = false;
    // Re-apply the caret after the mention popover restores focus on close.
    requestAnimationFrame(() => focusPrompt(richRef.current, ref.current, offset));
  });
}

export function useReferencePrompt({
  value,
  onChange,
  references,
  inputRef,
  maxLength,
  maxReferences,
  autoGrow,
  onReferencesInsert,
}: {
  value: string;
  onChange: (value: string) => void;
  references: readonly PromptReference[];
  inputRef: RefObject<HTMLTextAreaElement | null> | undefined;
  maxLength: number;
  maxReferences: number;
  autoGrow: boolean;
  onReferencesInsert: ((images: ReferenceImage[], prompt: string) => void) | undefined;
}) {
  const composing = useRef(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;
  const richRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(0);
  const focusPending = useRef(false);
  const parts = Array.from(value.matchAll(/@图片[1-9]\d*|[^@]+|@/g), (match) => match[0]);
  const hasReferences = value.includes("@");
  const mentionAnchor = useRef<HTMLElement | null>(null);
  const [anchoredMention, setAnchoredMention] = useState<number | null>(null);
  useControlledPrompt({ richRef, ref, value, parts, references, cursorRef, focusPending });
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
  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value.slice(0, maxLength);
    const cursor = Math.min(event.currentTarget.selectionStart, next.length);
    cursorRef.current = cursor;
    onChange(next);
    if (!composing.current) detect(next, cursor);
  }
  function beginComposition() {
    composing.current = true;
  }
  function endTextComposition(event: CompositionEvent<HTMLTextAreaElement>) {
    composing.current = false;
    detect(event.currentTarget.value, event.currentTarget.selectionStart);
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
    requestAnimationFrame(() => focusPrompt(richRef.current, ref.current, 0));
  }
  const usedIds = new Set(
    parts.flatMap((token) => {
      const image = referenceFor(token, references);
      return image ? [image.id, ...(image.assetId ? [image.assetId] : [])] : [];
    }),
  );
  function insert(images: ReferenceImage[]) {
    if (!mention || value[mention.start] !== "@") return;
    const { added, tokens } = buildMentionInsert(
      images,
      references,
      usedIds,
      maxReferences,
      Boolean(onReferencesInsert),
    );
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
  return {
    ref,
    richRef,
    composing,
    hasReferences,
    mention,
    anchoredMention,
    setMention,
    mentionAnchor,
    handleTextChange,
    beginComposition,
    endTextComposition,
    handleRichInput,
    clear,
    usedIds,
    insert,
  };
}
