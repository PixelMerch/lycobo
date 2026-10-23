import { Button, ErrorMessage } from "@heroui/react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { lazy, Suspense, useRef, useState } from "react";
import { ReferenceImageCard } from "../../../components/reference-image-card";
import { UiIcon } from "../../../components/ui-icon";
import {
  readReferenceImages,
  referenceFileError,
} from "../../generation/references/read-reference-images";
import type { ReferenceImage } from "../../generation/studio-state";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer").then((module) => ({ default: module.ImageViewer })),
);

export function TextileImageField({
  label,
  required = false,
  description,
  exampleSrc,
  exampleIsDetail = false,
  value,
  onChange,
  number,
}: {
  label: string;
  required?: boolean;
  description: string;
  exampleSrc: string;
  exampleIsDetail?: boolean;
  value: ReferenceImage | null;
  onChange: (value: ReferenceImage | null) => void;
  number: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  async function choose(files: File[]) {
    if (!files.length || reading) return;
    if (files.length > 1) {
      setError("每次只能上传一张图片。");
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
      const [image] = await readReferenceImages(files.slice(0, 1));
      if (image) onChange(image);
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
          {!required && <small>（可选）</small>}
        </h2>
        <Button
          variant="tertiary"
          size="sm"
          className="clear-references"
          aria-label={`清除${label}`}
          isDisabled={!value || reading}
          onPress={() => {
            onChange(null);
            setError("");
            setPreview(false);
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
        className="visually-hidden"
        aria-label={`${label}文件`}
        required={required}
        disabled={reading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void choose(files);
        }}
      />
      {value ? (
        <div className="textile-uploaded-image">
          <ReferenceImageCard
            src={value.src}
            number={number}
            showNumber={false}
            isDisabled={reading}
            onOpen={() => setPreview(true)}
            onRemove={() => {
              onChange(null);
              setError("");
              setPreview(false);
            }}
          />
        </div>
      ) : (
        <Button
          variant="tertiary"
          className="textile-upload-area"
          aria-label={`上传${label}`}
          isDisabled={reading}
          onPress={() => input.current?.click()}
        >
          <span
            className="textile-upload-example"
            data-detail={exampleIsDetail || undefined}
            aria-hidden="true"
          >
            <img
              src={exampleSrc}
              alt=""
              width="80"
              height="104"
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
      {preview && value && (
        <Suspense fallback={null}>
          <ImageViewer
            images={[{ src: value.src, alt: label }]}
            onClose={() => setPreview(false)}
          />
        </Suspense>
      )}
    </section>
  );
}
