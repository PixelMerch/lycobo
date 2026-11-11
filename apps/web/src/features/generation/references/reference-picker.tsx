import { Alert, Button, toast } from "@heroui/react";
import { IconPlus, IconTrash, type TablerIcon } from "@tabler/icons-react";
import { lazy, type RefObject, Suspense, useEffect, useRef, useState } from "react";
import { ReferenceImageCard } from "../../../components/reference-image/reference-image-card";
import { UiIcon } from "../../../components/ui-icon";
import { currentMessages, useMessages } from "../../../i18n/messages";
import { useRequireLogin } from "../../auth/login-prompt";
import { type Draft, type ModelId, type ReferenceImage, useStudioStore } from "../studio-state";
import { readReferenceImages, referenceFileError } from "./read-reference-images";
import { referenceDisplaySource } from "./reference-display";
import { ReferenceRoleMenu } from "./reference-role-menu";
import { referencesMessages } from "./references-messages";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer/image-viewer").then((module) => ({
    default: module.ImageViewer,
  })),
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
  /** 上传按钮上的文字；首页家纺裂变显示“家纺主图”。 */
  addLabel?: string;
  /** 上传按钮图标，默认加号。 */
  addIcon?: TablerIcon;
  /** 让调用方的其他入口也能打开同一个文件选择框，仍先检查登录。 */
  openRef?: RefObject<(() => void) | null>;
  compact?: boolean;
  isRequired?: boolean;
  showCount?: boolean;
  disabled?: boolean;
  /** 在缩略图上显示参考图角色（商品／原图／风格）；只用于主图制作与套图计划。 */
  withRoles?: boolean;
  references: Draft["references"];
} & (
  | { model: ModelId; prompt?: never; onChange?: never }
  | {
      model?: never;
      prompt: string;
      onChange: (references: ReferenceImage[], prompt: string) => void;
    }
);

function ReferencePickerTitle({
  label,
  count,
  limit,
  isRequired,
  showCount,
}: {
  label: string;
  count: number;
  limit: number;
  isRequired: boolean;
  showCount: boolean;
}) {
  const t = useMessages(referencesMessages);
  return (
    <h2>
      {label}
      {/* 用安静的“已传/上限”计数代替括号说明；完整句子留给读屏。 */}
      {isRequired && (
        <>
          <span className="required-indicator" aria-hidden="true">
            *
          </span>
          <span className="sr-only">{t.required}</span>
        </>
      )}
      {showCount && (
        <small className="reference-count" aria-hidden="true">
          {count}/{limit}
        </small>
      )}
      <span className="sr-only">{t.uploadCount(count, limit)}</span>
    </h2>
  );
}

/** 参考图上传与预览：首页和各工具共用编号、删除及提示词引用的同步规则。 */
export function ReferencePicker({
  model,
  references,
  compact = false,
  isRequired = false,
  showCount = true,
  disabled = false,
  withRoles = false,
  limit = 5,
  label,
  addLabel,
  addIcon = IconPlus,
  openRef,
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
  const t = useMessages(referencesMessages);
  const addText = addLabel ?? (compact ? t.uploadProduct : t.addImages);
  const openFiles = () => {
    if (requireLogin()) input.current?.click();
  };
  // 每次渲染后同步给调用方的额外入口，卸载时清空，避免指向已失效的输入框。
  useEffect(() => {
    if (!openRef) return;
    openRef.current = openFiles;
    return () => {
      openRef.current = null;
    };
  });
  return (
    <section className="reference-picker">
      <div className="field-title">
        <ReferencePickerTitle
          label={label ?? t.uploadLabel}
          count={references.length}
          limit={limit}
          isRequired={isRequired}
          showCount={showCount}
        />
        <Button
          variant="tertiary"
          className="clear-references"
          aria-label={t.clearAll}
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
          {t.clear}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        aria-label={t.addReferenceImages}
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
            footer={
              withRoles ? (
                <ReferenceRoleMenu
                  imageId={image.id}
                  name={t.imageName(index + 1)}
                  isDisabled={disabled || reading}
                />
              ) : undefined
            }
            onRemove={() => {
              const prompt = currentDraft()?.prompt ?? "";
              const remaining = references.filter((item) => item.id !== image.id);
              change(remaining, promptAfterReferenceRemoval(prompt, index + 1));
              // 删除图片后修正正在打开的预览序号，避免指向已移除的图片。
              setPreview((current) => previewAfterRemoval(current, index));
            }}
          />
        ))}
        {references.length < limit ? (
          <Button
            variant="tertiary"
            className="add-reference"
            isDisabled={disabled || reading || references.length >= limit}
            aria-label={t.addReference}
            onPress={openFiles}
          >
            <UiIcon icon={addIcon} size={compact ? "default" : "action"} />
            <span>{reading ? t.reading : addText}</span>
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
      {/* 图片加入草稿后即可预览，复用共享查看器，不另建图片浮层。 */}
      {preview !== null && references[preview] ? (
        <Suspense fallback={null}>
          <ImageViewer
            images={references.map((image, index) => ({
              src: referenceDisplaySource(image),
              thumbnailSrc: referenceDisplaySource(image, true),
              alt: t.imageName(index + 1),
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
    if (duplicates > 0) toast.warning(currentMessages(referencesMessages).duplicatesFiltered);
    if (!unique.length) return;
    if (unique.length > limit - current.length) {
      setError(currentMessages(referencesMessages).overLimit(limit));
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
      setError(
        error instanceof Error ? error.message : currentMessages(referencesMessages).unreadable,
      );
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
