import { Button, ErrorMessage } from "@heroui/react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { lazy, Suspense, useRef, useState } from "react";
import { ReferenceImageCard } from "../../../components/reference-image-card";
import { UiIcon } from "../../../components/ui-icon";
import {
  readReferenceImages,
  referenceFileError,
} from "../../generation/references/read-reference-images";
import { referenceDisplaySource } from "../../generation/references/reference-display";
import type { ReferenceImage } from "../../generation/studio-state";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer").then((module) => ({ default: module.ImageViewer })),
);

export function TextileImageField({
  label,
  required = false,
  description,
  exampleSrc,
  value,
  onChange,
  number,
  maxImages = 1,
}: {
  label: string;
  required?: boolean;
  description: string;
  exampleSrc: string;
  value: ReferenceImage[];
  onChange: (value: ReferenceImage[]) => void;
  number: number;
  maxImages?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const replacement = useRef<number | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const multiple = maxImages > 1;
  function openPicker(index: number | null = null) {
    replacement.current = index;
    if (input.current) {
      input.current.multiple = multiple && index === null;
      input.current.click();
    }
  }
  async function choose(files: File[]) {
    const index = replacement.current;
    replacement.current = null;
    if (!files.length || reading) return;
    const replacing = index !== null || !multiple;
    if (replacing && files.length > 1) {
      setError("每次只能上传一张图片。");
      return;
    }
    if (!replacing && value.length + files.length > maxImages) {
      setError(`详情图最多上传 ${maxImages} 张。`);
      return;
    }
    const issue = referenceFileError(files);
    if (issue) {
      setError(issue);
      return;
    }
    setReading(true);
    setError("");
    try {
      const images = await readReferenceImages(files);
      if (index !== null) {
        const first = images[0];
        if (first) onChange(value.map((image, position) => (position === index ? first : image)));
      } else onChange(multiple ? [...value, ...images] : images);
    } catch {
      setError("图片无法读取，请检查文件后重试。");
    } finally {
      setReading(false);
    }
  }
  return (
    <section className="reference-picker parameter-group textile-image-field" aria-label={label}>
      <div className="field-title">
        <h2>
          {required && (
            <span aria-hidden="true" className="textile-required">
              *
            </span>
          )}
          {label}
          {!required && <small>（可选，最多{maxImages}张）</small>}
        </h2>
        {value.length > 0 && (
          <Button
            variant="tertiary"
            size="sm"
            className="clear-references"
            aria-label={`清除${label}`}
            isDisabled={reading}
            onPress={() => {
              onChange([]);
              setError("");
              setPreview(null);
            }}
          >
            <UiIcon icon={IconTrash} size="small" />
            清除
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="visually-hidden"
        aria-label={`${label}文件`}
        required={required}
        multiple={multiple}
        disabled={reading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void choose(files);
        }}
      />
      {value.length > 0 ? (
        <div className={`textile-uploaded-image${multiple ? " textile-uploaded-details" : ""}`}>
          {value.map((image, index) => (
            <ReferenceImageCard
              key={image.id}
              src={referenceDisplaySource(image, true)}
              number={number + index}
              showNumber={false}
              isDisabled={reading}
              onOpen={() => setPreview(index)}
              onReplace={() => openPicker(index)}
              onRemove={() => {
                onChange(value.filter((entry) => entry.id !== image.id));
                setError("");
                setPreview(null);
              }}
            />
          ))}
          {multiple && value.length < maxImages && (
            <Button
              variant="tertiary"
              className="textile-detail-add"
              aria-label="添加详情图"
              isDisabled={reading}
              onPress={() => openPicker()}
            >
              <UiIcon icon={IconPlus} size="action" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          variant="tertiary"
          className="textile-upload-area"
          aria-label={`上传${label}`}
          isDisabled={reading}
          onPress={() => openPicker()}
        >
          <span className="textile-upload-example" aria-hidden="true">
            <img
              src={exampleSrc}
              alt=""
              width="108"
              height="144"
              decoding="async"
              draggable={false}
            />
            <span>示例</span>
          </span>
          <span className="textile-upload-copy">
            <UiIcon icon={IconPlus} size="action" />
            <span>{reading ? "读取中…" : description}</span>
          </span>
        </Button>
      )}
      {error && (
        <ErrorMessage role="alert" className="field-error">
          {error}
        </ErrorMessage>
      )}
      {preview !== null && value[preview] && (
        <Suspense fallback={null}>
          <ImageViewer
            images={value.map((image, index) => ({
              src: referenceDisplaySource(image),
              thumbnailSrc: referenceDisplaySource(image, true),
              alt: `${label}${index + 1}`,
            }))}
            initialIndex={preview}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
    </section>
  );
}
