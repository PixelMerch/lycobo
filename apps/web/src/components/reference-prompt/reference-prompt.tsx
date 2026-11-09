import { Button, Label, Popover, TextArea, TextField } from "@heroui/react";
import { type RefObject, useId } from "react";
import { PromptOptimizeActions } from "../../features/generation/references/prompt-optimize-actions";
import type { PromptOptimizeTool } from "../../features/generation/references/prompt-optimizer-client";
import { ReferenceMentionOptions } from "../../features/generation/references/reference-mention-options";
import { usePromptOptimizer } from "../../features/generation/references/use-prompt-optimizer";
import type { ReferenceImage } from "../../features/generation/studio-state";
import "./reference-prompt.css";
import "../studio-control-feedback.css";

import type { PromptReference } from "./reference-prompt-dom";
import { RichReferencePrompt } from "./rich-reference-prompt";
import { useReferencePrompt } from "./use-reference-prompt";

function textPasteHandler(
  tool: PromptOptimizeTool | undefined,
  optimizer: ReturnType<typeof usePromptOptimizer>,
) {
  return (text: string) => {
    if (tool && !optimizer.running && text.trim()) optimizer.dismissUndo();
  };
}

/** Mentions refer to the current ordered reference list; no files are uploaded here. */
export function ReferencePrompt({
  value: draftValue,
  onChange,
  references,
  className,
  label,
  placeholder,
  inputRef,
  maxLength = 9000,
  maxReferences = 5,
  showCount = false,
  autoGrow = false,
  isRequired = false,
  onReferencesInsert,
  optimizeTool,
}: {
  value: string;
  onChange: (value: string) => void;
  references: readonly PromptReference[];
  className: string;
  label?: string;
  placeholder: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  maxLength?: number;
  maxReferences?: number;
  showCount?: boolean;
  autoGrow?: boolean;
  isRequired?: boolean;
  onReferencesInsert?: (images: ReferenceImage[], prompt: string) => void;
  /** Shows the AI rewrite control for this tool's prompt. */
  optimizeTool?: PromptOptimizeTool;
}) {
  const optimizer = usePromptOptimizer({
    value: draftValue,
    onChange,
    maxLength,
    tool: optimizeTool,
  });
  const value = optimizer.preview ?? draftValue;
  const countId = useId();
  const labelId = useId();
  const editor = useReferencePrompt({
    value,
    onChange,
    references,
    inputRef,
    maxLength,
    maxReferences,
    autoGrow,
    onReferencesInsert,
  });
  const noteTextPaste = textPasteHandler(optimizeTool, optimizer);
  return (
    <>
      <TextField
        isRequired={isRequired}
        className={className}
        {...(label ? {} : { "aria-label": "创作需求" })}
      >
        {label && (
          <Label>
            <span id={labelId}>{label}</span>
          </Label>
        )}
        <div
          className="prompt-editor"
          data-count={showCount ? "" : undefined}
          data-auto-grow={autoGrow ? "" : undefined}
          data-optimizable={optimizeTool ? "" : undefined}
          data-optimizing={optimizer.running ? "" : undefined}
        >
          <PromptInput
            editor={editor}
            label={label}
            isRequired={isRequired}
            countId={showCount ? countId : undefined}
            labelId={label ? labelId : undefined}
            autoGrow={autoGrow}
            busy={optimizer.running}
            maxLength={maxLength}
            value={value}
            placeholder={placeholder}
            noteTextPaste={noteTextPaste}
          />
          {optimizeTool && <PromptOptimizeActions optimizer={optimizer} prompt={draftValue} />}
          {showCount && (
            <PromptCount
              countId={countId}
              length={value.length}
              maxLength={maxLength}
              busy={optimizer.running}
              clear={editor.clear}
            />
          )}
        </div>
      </TextField>
      <PromptMentionPopover
        editor={editor}
        references={references}
        maxReferences={maxReferences}
        allowHistory={Boolean(onReferencesInsert)}
      />
    </>
  );
}

function PromptCount({
  countId,
  length,
  maxLength,
  busy,
  clear,
}: {
  countId: string;
  length: number;
  maxLength: number;
  busy: boolean;
  clear: () => void;
}) {
  return (
    <div className="prompt-meta">
      {length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="prompt-clear"
          aria-label="清空提示词"
          isDisabled={busy}
          onPress={clear}
        >
          清空
        </Button>
      )}
      <span id={countId} className="prompt-count">
        {length}/{maxLength}
      </span>
    </div>
  );
}

function PromptMentionPopover({
  editor,
  references,
  maxReferences,
  allowHistory,
}: {
  editor: ReturnType<typeof useReferencePrompt>;
  references: readonly PromptReference[];
  maxReferences: number;
  allowHistory: boolean;
}) {
  const { mention, anchoredMention, setMention, mentionAnchor, usedIds, insert } = editor;
  return (
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
              maxReferences={maxReferences}
              references={references}
              usedIds={usedIds}
              onSelect={insert}
              allowHistory={allowHistory}
            />
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function PromptInput({
  editor,
  label,
  isRequired,
  countId,
  labelId,
  autoGrow,
  busy,
  maxLength,
  value,
  placeholder,
  noteTextPaste,
}: {
  editor: ReturnType<typeof useReferencePrompt>;
  label: string | undefined;
  isRequired: boolean;
  countId: string | undefined;
  labelId: string | undefined;
  autoGrow: boolean;
  busy: boolean;
  maxLength: number;
  value: string;
  placeholder: string;
  noteTextPaste: (text: string) => void;
}) {
  if (editor.hasReferences)
    return (
      <RichReferencePrompt
        editorRef={editor.richRef}
        label={label}
        isRequired={isRequired}
        countId={countId}
        autoGrow={autoGrow}
        busy={busy}
        maxLength={maxLength}
        value={value}
        composing={editor.composing}
        handleRichInput={editor.handleRichInput}
        noteTextPaste={noteTextPaste}
      />
    );
  return (
    <TextArea
      ref={editor.ref}
      aria-label={label ?? "创作需求"}
      aria-labelledby={labelId}
      aria-describedby={countId}
      aria-busy={busy || undefined}
      readOnly={busy}
      value={value}
      onPaste={(event) => noteTextPaste(event.clipboardData.getData("text/plain"))}
      onChange={editor.handleTextChange}
      onCompositionStart={editor.beginComposition}
      onCompositionEnd={editor.endTextComposition}
      placeholder={placeholder}
      maxLength={maxLength}
      data-auto-grow={autoGrow ? "" : undefined}
    />
  );
}
