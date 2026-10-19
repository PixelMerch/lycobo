import { Button, ListBox, Popover, TextArea } from "@heroui/react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { type ReferenceImage, type ReferenceUpload, useDesignStore } from "./design-data";
import {
  formatReferencePrompt,
  insertReferenceSpace,
  parseReferencePrompt,
} from "./reference-prompt";

export function ReferenceThumbnail({ image }: { image: ReferenceImage }) {
  return image.src ? (
    <img
      className="reference-thumbnail"
      src={image.src}
      alt={`图片${image.number} · ${image.name}`}
    />
  ) : (
    <div
      className={`reference-thumbnail product-shot shot-${image.shot}`}
      role="img"
      aria-label={`图片${image.number} · ${image.name}`}
    />
  );
}

async function readImage(file: File): Promise<ReferenceUpload> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`${file.name}：请选择 JPG、PNG 或 WebP 图片`);
  }
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}：单张图片不能超过 10MB`);
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name}：读取失败，请重试`));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    throw new Error(`${file.name}：无法读取图片内容`);
  }
  return { id: crypto.randomUUID(), name: file.name, src };
}

export function ReferenceInput({ compact }: { compact: boolean }) {
  const references = useDesignStore((s) => s.references);
  const prompt = useDesignStore((s) => s.prompt);
  const setDraft = useDesignStore((s) => s.setDraft);
  const removeReference = useDesignStore((s) => s.removeReference);
  const addReferences = useDesignStore((s) => s.addReferences);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { selected, description } = parseReferencePrompt(prompt, references);
  const selection = useRef({ start: description.length, end: description.length });
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [replaceAt, setReplaceAt] = useState(false);
  const id = compact ? "canvas-prompt" : "demo-prompt";

  async function upload(files: File[]) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const available = 5 - useDesignStore.getState().references.length;
    const messages =
      files.length > available ? [`最多添加 5 张参考图，本次仅处理前 ${available} 张`] : [];
    try {
      const results = await Promise.allSettled(files.slice(0, available).map(readImage));
      const images: ReferenceUpload[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") images.push(result.value);
        else messages.push(result.reason instanceof Error ? result.reason.message : "图片读取失败");
      }
      addReferences(images);
      setError(messages.join("；"));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  function insertMention(key: string) {
    const reference = references.find((image) => image.id === key);
    if (!reference) return;
    if (selected.some((image) => image.id === key)) return;
    const { start, end } = selection.current;
    const from = replaceAt ? Math.max(0, start - 1) : start;
    const inserted = insertReferenceSpace(description, from, end);
    const next = formatReferencePrompt([...selected, reference], inserted.description);
    if (next.length > 2000) {
      setError("描述最多 2000 字，请缩短后再引用图片");
      return;
    }
    setDraft(next);
    setMentionOpen(false);
    setReplaceAt(false);
    // Restore the insertion point after HeroUI restores focus from the popover.
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(inserted.caret, inserted.caret);
      selection.current = { start: inserted.caret, end: inserted.caret };
    });
  }

  return (
    <>
      <div className="reference-strip">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="上传参考图"
          className="visually-hidden"
          disabled={references.length >= 5 || loading}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void upload(files);
          }}
        />
        <Button
          variant="tertiary"
          className="add-reference"
          aria-label="添加参考图，最多5张"
          isDisabled={references.length >= 5 || loading}
          onPress={() => fileInput.current?.click()}
        >
          <UiIcon icon={IconPlus} size="action" />
        </Button>
        {references.map((image) => (
          <div className="reference-tile" key={image.id}>
            <ReferenceThumbnail image={image} />
            <span className="reference-number">{image.number}</span>
            <Button
              variant="tertiary"
              className="reference-remove"
              aria-label={`移除图片${image.number}`}
              onPress={() => {
                removeReference(image.id);
                setError("");
              }}
            >
              <UiIcon icon={IconX} size="small" />
            </Button>
          </div>
        ))}
        {loading ? (
          <span className="reference-loading" role="status">
            正在读取…
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="reference-error">
          {error}
        </p>
      ) : null}
      <label className="visually-hidden" htmlFor={id}>
        描述想要的画面
      </label>
      <div className="prompt-field">
        {selected.length > 0 ? (
          <ul className="prompt-selected-references" aria-label="已引用图片">
            {selected.map((image) => (
              <li key={image.id} className="prompt-mention-tag">
                <ReferenceThumbnail image={image} />
                <span>图片{image.number}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <TextArea
          ref={textarea}
          id={id}
          className="demo-prompt"
          fullWidth
          rows={compact ? 4 : 3}
          maxLength={2000}
          value={description}
          placeholder="描述想要的画面，输入 @ 引用图片…"
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || selected.length === 0) return;
            const { selectionStart, selectionEnd } = event.currentTarget;
            const deleting = event.key === "Backspace" || event.key === "Delete";
            if (!deleting) return;
            if (selectionStart === 0 && selectionEnd === description.length && selectionEnd > 0) {
              event.preventDefault();
              setDraft("");
              setError("");
            } else if (event.key === "Backspace" && selectionStart === 0 && selectionEnd === 0) {
              event.preventDefault();
              setDraft(formatReferencePrompt(selected.slice(0, -1), description));
              setError("");
            }
          }}
          onSelect={(event) => {
            selection.current = {
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            };
          }}
          onChange={(event) => {
            const { value, selectionStart, selectionEnd } = event.target;
            const parsed = parseReferencePrompt(formatReferencePrompt(selected, value), references);
            const next = formatReferencePrompt(parsed.selected, parsed.description);
            if (next.length > 2000) {
              setError("描述最多 2000 字，请缩短后再输入");
              return;
            }
            setDraft(next);
            selection.current = { start: selectionStart, end: selectionEnd };
            if (value[selectionStart - 1] === "@" && references.length > 0) {
              setReplaceAt(true);
              setMentionOpen(true);
            }
          }}
        />
      </div>
      <Popover
        isOpen={mentionOpen}
        onOpenChange={(open) => {
          setMentionOpen(open);
          if (!open) setReplaceAt(false);
        }}
      >
        <Popover.Content
          triggerRef={textarea}
          className="reference-mention-popover"
          placement="bottom start"
        >
          <Popover.Dialog aria-label="选择引用图片" className="reference-mention-dialog">
            <p className="reference-mention-heading">图片</p>
            <ListBox
              aria-label="参考图片"
              disabledKeys={selected.map((image) => image.id)}
              onAction={(key) => insertMention(String(key))}
            >
              {references.map((image) => (
                <ListBox.Item
                  key={image.id}
                  id={image.id}
                  textValue={`图片${image.number}`}
                  aria-label={`图片${image.number}`}
                  className="reference-mention-option"
                >
                  <ReferenceThumbnail image={image} />
                  <span>图片{image.number}</span>
                  {selected.some((item) => item.id === image.id) ? <small>已引用</small> : null}
                </ListBox.Item>
              ))}
            </ListBox>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </>
  );
}
