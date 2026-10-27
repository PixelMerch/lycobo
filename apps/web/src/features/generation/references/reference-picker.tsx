import { Alert, Button, toast } from "@heroui/react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { lazy, Suspense, useRef, useState } from "react";
import { ReferenceImageCard } from "../../../components/reference-image-card";
import { UiIcon } from "../../../components/ui-icon";
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

export function ReferencePicker({
  model,
  references,
  compact = false,
}: {
  compact?: boolean;
  model: ModelId;
  references: Draft["references"];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const addReferences = useStudioStore((s) => s.addReferences);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  async function readFiles(files: File[]) {
    if (reading) return;
    const issue = referenceFileError(files);
    if (issue) {
      setError(issue);
      return;
    }
    setReading(true);
    setError("");
    try {
      const images = await readReferenceImages(files);
      const current = useStudioStore.getState().drafts[model].references;
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
      if (duplicates > 0) toast.warning("存在相同素材，已自动过滤");
      if (!unique.length) return;
      if (unique.length > 5 - current.length) {
        setError("最多添加 5 张参考图，请减少文件后重试。");
        return;
      }
      addReferences(model, unique);
    } catch {
      setError("图片无法读取，请检查文件后重试。");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="reference-picker">
      <div className="field-title">
        <h2>
          上传图片<small>（最多上传5张参考图）</small>
        </h2>
        <Button
          variant="tertiary"
          className="clear-references"
          aria-label="清除全部参考图片"
          isDisabled={reading || references.length === 0}
          onPress={() => {
            const prompt = useStudioStore.getState().drafts[model].prompt;
            updateDraft(model, { references: [], prompt: promptWithoutReferences(prompt) });
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
        disabled={reading || references.length >= 5}
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
            isDisabled={reading}
            onOpen={() => setPreview(index)}
            onRemove={() => {
              const prompt = useStudioStore.getState().drafts[model].prompt;
              const remaining = references.filter((item) => item.id !== image.id);
              updateDraft(model, {
                references: remaining,
                prompt: promptAfterReferenceRemoval(prompt, index + 1),
              });
              // Keep an open preview valid after the removed image disappears.
              setPreview((current) =>
                current === null
                  ? null
                  : current === index
                    ? null
                    : current > index
                      ? current - 1
                      : current,
              );
            }}
          />
        ))}
        {references.length < 5 ? (
          <Button
            variant="tertiary"
            className="add-reference"
            isDisabled={reading || references.length >= 5}
            aria-label="添加参考图"
            onPress={() => input.current?.click()}
          >
            <UiIcon icon={IconPlus} size={compact ? "default" : "action"} />
            <span>{reading ? "读取中…" : compact ? "上传商品图" : "添加图片"}</span>
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
