import { Label, ListBox, Popover, TextArea, TextField } from "@heroui/react";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import "./reference-prompt.css";
import "./studio-control-feedback.css";

/** Mentions refer to the current ordered reference list; no files are uploaded here. */
export function ReferencePrompt({
  value,
  onChange,
  references,
  className,
  label,
  placeholder,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  references: readonly { id: string; src: string }[];
  className: string;
  label?: string;
  placeholder: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const parts = Array.from(value.matchAll(/@图片[1-9]\d*|[^@]+|@/g), (match) => ({
    text: match[0],
    offset: match.index,
  }));
  const isReference = (text: string) =>
    /^@图片[1-9]\d*$/.test(text) && Number(text.slice(3)) <= references.length;
  const hasReferences = parts.some((part) => isReference(part.text));
  const composing = useRef(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;
  useLayoutEffect(() => {
    const input = ref.current;
    const mirror = mirrorRef.current;
    if (!input || !mirror) return;
    const sync = () => {
      const style = getComputedStyle(input);
      for (const property of [
        "font",
        "letter-spacing",
        "padding",
        "border-width",
        "box-sizing",
        "text-align",
        "word-break",
        "overflow-wrap",
        "tab-size",
      ]) {
        mirror.style.setProperty(property, style.getPropertyValue(property));
      }
      mirror.scrollTop = input.scrollTop;
      mirror.scrollLeft = input.scrollLeft;
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(input);
    return () => observer.disconnect();
  }, [ref]);
  const [mention, setMention] = useState<{ start: number; end: number } | null>(null);
  function detect(input: HTMLTextAreaElement) {
    const cursor = input.selectionStart;
    if (input.selectionStart === input.selectionEnd && input.value[cursor - 1] === "@") {
      setMention({ start: cursor - 1, end: cursor });
    }
  }
  function insert(id: string) {
    const index = references.findIndex((image) => image.id === id);
    if (!mention || index < 0 || value[mention.start] !== "@") return;
    const text = `@图片${index + 1} `;
    const next = value.slice(0, mention.start) + text + value.slice(mention.end);
    if (next.length > 9000) return;
    onChange(next);
    const cursor = mention.start + text.length;
    setMention(null);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(cursor, cursor);
    });
  }
  return (
    <>
      <TextField className={className} aria-label={label ?? "创作需求"}>
        {label && <Label>{label}</Label>}
        <div className="reference-prompt-editor" data-has-references={hasReferences || undefined}>
          <div ref={mirrorRef} className="reference-prompt-mirror" aria-hidden="true">
            {parts.map((part) =>
              isReference(part.text) ? <mark key={part.offset}>{part.text}</mark> : part.text,
            )}
            {"\n"}
          </div>
          <TextArea
            ref={ref}
            aria-label={label ?? "创作需求"}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              if (!composing.current) detect(event.currentTarget);
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              detect(event.currentTarget);
            }}
            onScroll={(event) => {
              if (mirrorRef.current) {
                mirrorRef.current.scrollTop = event.currentTarget.scrollTop;
                mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
              }
            }}
            placeholder={placeholder}
            maxLength={9000}
          />
        </div>
      </TextField>
      <Popover
        isOpen={mention !== null}
        onOpenChange={(open) => {
          if (!open) setMention(null);
        }}
      >
        <Popover.Content
          triggerRef={ref}
          placement="bottom start"
          offset={4}
          className="reference-mention-popover"
        >
          <Popover.Dialog aria-label="引用已上传图片">
            <Popover.Heading>图片</Popover.Heading>
            {references.length ? (
              <ListBox
                aria-label="已上传图片"
                autoFocus="first"
                onAction={(key) => insert(String(key))}
              >
                {references.map((image, index) => (
                  <ListBox.Item key={image.id} id={image.id} textValue={`图片${index + 1}`}>
                    <img src={image.src} alt="" />
                    <span>图片{index + 1}</span>
                  </ListBox.Item>
                ))}
              </ListBox>
            ) : (
              <p className="reference-mention-empty">请先上传参考图片</p>
            )}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </>
  );
}
