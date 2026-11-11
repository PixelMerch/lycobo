import { Button, Label, Popover, TextArea, TextField } from "@heroui/react";
import { type RefObject, useId } from "react";
import { PromptOptimizeActions } from "../../features/generation/references/prompt-optimize-actions";
import type { PromptOptimizeTool } from "../../features/generation/references/prompt-optimizer-client";
import { ReferenceMentionOptions } from "../../features/generation/references/reference-mention-options";
import { usePromptOptimizer } from "../../features/generation/references/use-prompt-optimizer";
import type { ReferenceImage } from "../../features/generation/studio-state";
import "./reference-prompt.css";
import "../studio-control-feedback.css";

import { useMessages } from "../../i18n/messages";
import { componentsMessages } from "../components-messages";
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

/** 带 @ 引用的描述输入：引用指向当前按顺序排列的参考图，这里不上传任何文件。 */
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
  autoGrowMinHeight,
  isRequired = false,
  onReferencesInsert,
  unavailableReferenceIds,
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
  /** 自动增高时空白输入区的最小高度，默认 100px。 */
  autoGrowMinHeight?: number;
  isRequired?: boolean;
  onReferencesInsert?: (images: ReferenceImage[], prompt: string) => void;
  unavailableReferenceIds?: readonly string[] | undefined;
  /** 为这个工具的描述显示 AI 润色入口。 */
  optimizeTool?: PromptOptimizeTool;
}) {
  const t = useMessages(componentsMessages);
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
    autoGrowMinHeight,
    onReferencesInsert,
  });
  const noteTextPaste = textPasteHandler(optimizeTool, optimizer);
  return (
    <>
      <TextField
        isRequired={isRequired}
        className={className}
        {...(label ? {} : { "aria-label": t.promptLabel })}
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
        unavailableReferenceIds={unavailableReferenceIds}
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
  const t = useMessages(componentsMessages);
  return (
    <div className="prompt-meta">
      {length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="prompt-clear"
          aria-label={t.clearPrompt}
          isDisabled={busy}
          onPress={clear}
        >
          {t.clear}
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
  unavailableReferenceIds,
}: {
  editor: ReturnType<typeof useReferencePrompt>;
  references: readonly PromptReference[];
  maxReferences: number;
  allowHistory: boolean;
  unavailableReferenceIds: readonly string[] | undefined;
}) {
  const t = useMessages(componentsMessages);
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
        shouldFlip
        offset={8}
        className="reference-mention-popover"
      >
        <Popover.Dialog aria-label={t.insertImage}>
          {mention && (
            <ReferenceMentionOptions
              maxReferences={maxReferences}
              references={references}
              usedIds={
                unavailableReferenceIds
                  ? new Set([...usedIds, ...unavailableReferenceIds])
                  : usedIds
              }
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
  const t = useMessages(componentsMessages);
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
      aria-label={label ?? t.promptLabel}
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
