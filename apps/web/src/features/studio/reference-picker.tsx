import { Alert, Button } from "@heroui/react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { ReferenceImageCard } from "../../components/reference-image-card";
import { UiIcon } from "../../components/ui-icon";
import { type Draft, type ModelId, type ReferenceImage, useStudioStore } from "./studio-state";

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
  const addReferences = useStudioStore((s) => s.addReferences);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  async function readFiles(files: File[]) {
    if (reading) return;
    const remaining = 5 - useStudioStore.getState().drafts[model].references.length;
    if (files.length > remaining) {
      setError("最多添加 5 张参考图，请减少文件后重试。");
      return;
    }
    if (
      files.some(
        (file) =>
          !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setError("请选择 PNG、JPEG 或 WebP 图片，单张不超过 10MB。");
      return;
    }
    setReading(true);
    setError("");
    try {
      const images = await Promise.all(
        files.map(async (file): Promise<ReferenceImage> => {
          const src = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              typeof reader.result === "string"
                ? resolve(reader.result)
                : reject(new Error("invalid image"));
            reader.onerror = () => reject(new Error("read failed"));
            reader.readAsDataURL(file);
          });
          await new Promise<void>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("decode failed"));
            image.src = src;
          });
          return { id: crypto.randomUUID(), name: file.name, src };
        }),
      );
      addReferences(model, images);
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
            updateDraft(model, { references: [] });
            setError("");
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
            src={image.src}
            number={index + 1}
            isDisabled={reading}
            onRemove={() =>
              updateDraft(model, {
                references: references.filter((item) => item.id !== image.id),
              })
            }
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
    </section>
  );
}
