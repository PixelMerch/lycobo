import { Button, ErrorMessage } from "@heroui/react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { lazy, Suspense, useRef, useState } from "react";
import { ReferenceImageCard } from "../../../components/reference-image/reference-image-card";
import { UiIcon } from "../../../components/ui-icon";
import {
  readReferenceImages,
  referenceFileError,
} from "../../generation/references/read-reference-images";
import { referenceDisplaySource } from "../../generation/references/reference-display";
import type { ReferenceImage } from "../../generation/studio-state";
// The field brings its own styles so other tools (视频创作) can reuse it.
import "./textile-set.css";
import { currentMessages, useMessages } from "../../../i18n/messages";
import { textileMessages } from "./textile-messages";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer/image-viewer").then((module) => ({
    default: module.ImageViewer,
  })),
);

function textileUploadError(
  files: File[],
  replacing: boolean,
  previousCount: number,
  maxImages: number,
) {
  const t = currentMessages(textileMessages);
  if (replacing && files.length > 1) return t.oneAtATime;
  if (!replacing && previousCount + files.length > maxImages) return t.detailLimit(maxImages);
  return referenceFileError(files);
}

function nextTextileImages(
  value: ReferenceImage[],
  images: ReferenceImage[],
  index: number | null,
  multiple: boolean,
) {
  if (index === null) return multiple ? [...value, ...images] : images;
  const first = images[0];
  return first ? value.map((image, position) => (position === index ? first : image)) : value;
}

// 读取用户选中的文件：校验数量与格式，新增或替换指定位置的图片，读取期间显示“读取中”。
function useTextileImageChooser({
  value,
  onChange,
  maxImages,
}: {
  value: ReferenceImage[];
  onChange: (value: ReferenceImage[]) => void;
  maxImages: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const replacement = useRef<number | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
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
    const issue = textileUploadError(files, index !== null || !multiple, value.length, maxImages);
    if (issue) {
      setError(issue);
      return;
    }
    setReading(true);
    setError("");
    try {
      const images = await readReferenceImages(files);
      const next = nextTextileImages(value, images, index, multiple);
      if (next !== value) onChange(next);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : currentMessages(textileMessages).unreadable,
      );
    } finally {
      setReading(false);
    }
  }
  return { input, reading, error, setError, multiple, openPicker, choose };
}

/** 家纺裂变的图片上传区：主图或详情图，可预览、替换和清除。 */
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
  const { input, reading, error, setError, multiple, openPicker, choose } = useTextileImageChooser({
    value,
    onChange,
    maxImages,
  });
  const [preview, setPreview] = useState<number | null>(null);
  const t = useMessages(textileMessages);
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
          {!required && (
            <small>
              {t.optionalLimitBefore}
              {maxImages}
              {t.optionalLimitAfter}
            </small>
          )}
        </h2>
        {value.length > 0 && (
          <Button
            variant="tertiary"
            size="sm"
            className="clear-references"
            aria-label={t.clearField(label)}
            isDisabled={reading}
            onPress={() => {
              onChange([]);
              setError("");
              setPreview(null);
            }}
          >
            <UiIcon icon={IconTrash} size="small" />
            {t.clear}
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="visually-hidden"
        aria-label={t.fieldFile(label)}
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
              aria-label={t.addDetail}
              isDisabled={reading}
              onPress={() => openPicker()}
            >
              <UiIcon icon={IconPlus} size="action" />
            </Button>
          )}
        </div>
      ) : (
        <TextileUploadExample
          label={label}
          reading={reading}
          exampleSrc={exampleSrc}
          description={description}
          openPicker={() => openPicker()}
        />
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
              alt: t.numbered(label, index + 1),
            }))}
            initialIndex={preview}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
    </section>
  );
}

function TextileUploadExample({
  label,
  reading,
  exampleSrc,
  description,
  openPicker,
}: {
  label: string;
  reading: boolean;
  exampleSrc: string;
  description: string;
  openPicker: () => void;
}) {
  const t = useMessages(textileMessages);
  return (
    <Button
      variant="tertiary"
      className="textile-upload-area"
      aria-label={t.upload(label)}
      isDisabled={reading}
      onPress={openPicker}
    >
      <span className="textile-upload-example" aria-hidden="true">
        <img src={exampleSrc} alt="" width="108" height="144" decoding="async" draggable={false} />
        <span>{t.example}</span>
      </span>
      <span className="textile-upload-copy">
        <UiIcon icon={IconPlus} size="action" />
        <span>{reading ? t.reading : description}</span>
      </span>
    </Button>
  );
}
