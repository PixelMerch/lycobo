import { Alert, Button, toast } from "@heroui/react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { lazy, Suspense, useRef, useState } from "react";
import { ReferenceImageCard } from "../../../components/reference-image-card";
import { UiIcon } from "../../../components/ui-icon";
import { useRequireLogin } from "../../auth/login-prompt";
import { type Draft, type ModelId, type ReferenceImage, useStudioStore } from "../studio-state";
import { readReferenceImages, referenceFileError } from "./read-reference-images";
import { referenceDisplaySource } from "./reference-display";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer").then((module) => ({ default: module.ImageViewer })),
);

/** Drop the removed image mention and renumber later mentions to the new order. */
function promptAfterReferenceRemoval(prompt: string, removedNumber: number) {
  return prompt
    .replace(new RegExp(`@图片${removedNumber}(?!\\d)`, "g"), "")
    .replace(/@图片([1-9]\d*)/g, (token, raw: string) => {
      const number = Number(raw);
      return number > removedNumber ? `@图片${number - 1}` : token;
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+/gm, "");
}
function promptWithoutReferences(prompt: string) {
  return prompt
    .replace(/@图片[1-9]\d*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+/gm, "");
}

type PickerProps = {
  limit?: number;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  references: Draft["references"];
} & (
  | { model: ModelId; prompt?: never; onChange?: never }
  | {
      model?: never;
      prompt: string;
      onChange: (references: ReferenceImage[], prompt: string) => void;
    }
);

export function ReferencePicker({
  model,
  references,
  compact = false,
  disabled = false,
  limit = 5,
  label = "上传图片",
  prompt = "",
  onChange,
}: PickerProps) {
  const {
    requireLogin,
    input,
    error,
    setError,
    reading,
    preview,
    setPreview,
    currentDraft,
    change,
    readFiles,
  } = useReferencePicker({ model, references, prompt, onChange, disabled, limit });
  const addLabel = compact ? "上传商品图" : "添加图片";
  return (
    <section className="reference-picker">
      <div className="field-title">
        <h2>
          {label}
          <small>（最多上传{limit}张参考图）</small>
        </h2>
        <Button
          variant="tertiary"
          className="clear-references"
          aria-label="清除全部参考图片"
          isDisabled={disabled || reading || references.length === 0}
          onPress={() => {
            const prompt = currentDraft()?.prompt ?? "";
            change([], promptWithoutReferences(prompt));
            setError("");
            setPreview(null);
            if (input.current) input.current.value = "";
          }}
        >
          <UiIcon icon={IconTrash} size="small" />
          清除
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        aria-label="添加参考图片"
        className="visually-hidden"
        disabled={disabled || reading || references.length >= limit}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void readFiles(files);
        }}
      />
      <div className="reference-grid">
        {references.map((image, index) => (
          <ReferenceImageCard
            key={image.id}
            src={referenceDisplaySource(image, true)}
            number={index + 1}
            isDisabled={disabled || reading}
            onOpen={() => setPreview(index)}
            onRemove={() => {
              const prompt = currentDraft()?.prompt ?? "";
              const remaining = references.filter((item) => item.id !== image.id);
              change(remaining, promptAfterReferenceRemoval(prompt, index + 1));
              // Keep an open preview valid after the removed image disappears.
              setPreview((current) => previewAfterRemoval(current, index));
            }}
          />
        ))}
        {references.length < limit ? (
          <Button
            variant="tertiary"
            className="add-reference"
            isDisabled={disabled || reading || references.length >= limit}
            aria-label="添加参考图"
            onPress={() => {
              if (requireLogin()) input.current?.click();
            }}
          >
            <UiIcon icon={IconPlus} size={compact ? "default" : "action"} />
            <span>{reading ? "读取中…" : addLabel}</span>
          </Button>
        ) : null}
      </div>
      {error ? (
        <Alert className="field-error" role="alert" status="danger">
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {/* Uploaded drafts become previewable the moment they are added, reusing
       * the shared viewer instead of a second image overlay. */}
      {preview !== null && references[preview] ? (
        <Suspense fallback={null}>
          <ImageViewer
            images={references.map((image, index) => ({
              src: referenceDisplaySource(image),
              thumbnailSrc: referenceDisplaySource(image, true),
              alt: `图片${index + 1}`,
            }))}
            initialIndex={preview}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

function previewAfterRemoval(current: number | null, removed: number) {
  if (current === null || current === removed) return null;
  return current > removed ? current - 1 : current;
}

function uniqueReferenceImages(current: ReferenceImage[], images: ReferenceImage[]) {
  const seen = new Set(current.map((image) => image.src));
  const unique: ReferenceImage[] = [];
  let duplicates = 0;
  for (const image of images) {
    if (seen.has(image.src)) {
      duplicates += 1;
      continue;
    }
    seen.add(image.src);
    unique.push(image);
  }
  return { unique, duplicates };
}

function useReferencePicker({
  model,
  references,
  prompt,
  onChange,
  disabled,
  limit,
}: {
  model: ModelId | undefined;
  references: ReferenceImage[];
  prompt: string;
  onChange: PickerProps["onChange"];
  disabled: boolean;
  limit: number;
}) {
  const requireLogin = useRequireLogin();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const currentDraft = () =>
    model !== undefined ? useStudioStore.getState().drafts[model] : { references, prompt };
  function change(next: ReferenceImage[], text: string) {
    if (model !== undefined) updateDraft(model, { references: next, prompt: text });
    else onChange?.(next, text);
  }
  function appendImages(current: ReferenceImage[], unique: ReferenceImage[], duplicates: number) {
    if (duplicates > 0) toast.warning("存在相同素材，已自动过滤");
    if (!unique.length) return;
    if (unique.length > limit - current.length) {
      setError(`最多添加 ${limit} 张参考图，请减少文件后重试。`);
      return;
    }
    change([...current, ...unique], currentDraft()?.prompt ?? "");
  }
  async function readFiles(files: File[]) {
    const unavailable = reading || disabled;
    if (!requireLogin() || unavailable) return;
    const issue = referenceFileError(files);
    if (issue) {
      setError(issue);
      return;
    }
    setReading(true);
    setError("");
    try {
      const images = await readReferenceImages(files);
      const current = currentDraft()?.references ?? [];
      const { unique, duplicates } = uniqueReferenceImages(current, images);
      appendImages(current, unique, duplicates);
    } catch (error) {
      setError(error instanceof Error ? error.message : "图片无法读取，请检查文件后重试。");
    } finally {
      setReading(false);
      clearReferenceInput(input.current);
    }
  }
  return {
    requireLogin,
    input,
    error,
    setError,
    reading,
    preview,
    setPreview,
    currentDraft,
    change,
    readFiles,
  };
}

function clearReferenceInput(input: HTMLInputElement | null) {
  if (input) input.value = "";
}
