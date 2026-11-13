import { Button, TextArea, toast } from "@heroui/react";
import {
  IconArrowUp,
  IconAspectRatio,
  IconPhotoPlus,
  IconPlus,
  IconSettings,
  IconShoppingBag,
} from "@tabler/icons-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { landingMessages } from "./landing-messages";

/** 首屏产品上传卡：选择本地产品图、填写场景描述，演示版不提交真实生成。 */
export function ProductUploadPanel() {
  const t = useMessages(landingMessages).hero;
  const [scene, setScene] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onRemix = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: { title?: unknown; description?: unknown } = event.detail;
      if (typeof detail.title !== "string" || typeof detail.description !== "string") return;
      setScene(t.remixPrompt(detail.title, detail.description));
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => textarea.current?.focus(), 650);
    };
    const onFocus = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => textarea.current?.focus(), 650);
    };
    window.addEventListener("lp:remix", onRemix);
    window.addEventListener("lp:focus-composer", onFocus);
    return () => {
      window.removeEventListener("lp:remix", onRemix);
      window.removeEventListener("lp:focus-composer", onFocus);
    };
  }, [t]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function openPicker() {
    input.current?.click();
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    event.target.value = "";
  }

  return (
    <section aria-label={t.uploadPhoto} className="lp-uploadPanel">
      <input
        accept="image/png,image/jpeg,image/webp"
        aria-label={t.uploadPhoto}
        className="visually-hidden"
        onChange={selectFile}
        ref={input}
        type="file"
      />

      <div className="lp-uploadComposer">
        <Button
          isIconOnly
          aria-label={preview ? t.replacePhoto : t.uploadPhoto}
          className="lp-uploadAdd"
          onPress={openPicker}
        >
          {preview ? (
            <>
              <img alt="" src={preview} />
              <span>{t.replacePhoto}</span>
            </>
          ) : (
            <IconPlus aria-hidden="true" size={24} />
          )}
        </Button>

        <TextArea
          aria-label={t.sceneLabel}
          className="lp-uploadText"
          placeholder={t.scenePlaceholder}
          ref={textarea}
          value={scene}
          onChange={(event) => setScene(event.target.value)}
        />
      </div>

      <div className="lp-uploadToolbar">
        <div className="lp-uploadChips">
          <Button className="lp-uploadChip" onPress={openPicker}>
            <IconPhotoPlus aria-hidden="true" size={15} />
            <span>{preview ? t.replacePhoto : t.uploadPhoto}</span>
          </Button>
          <span className="lp-uploadChip">
            <IconShoppingBag aria-hidden="true" size={15} />
            <span>{t.product}</span>
          </span>
          <span className="lp-uploadChip">
            <IconAspectRatio aria-hidden="true" size={15} />
            <span>{t.formatChip}</span>
          </span>
          <span className="lp-uploadChip">
            <IconSettings aria-hidden="true" size={15} />
            <span>{t.settings}</span>
          </span>
        </div>
        <Button
          isIconOnly
          aria-label={t.generateProduct}
          className="lp-generateButton"
          isDisabled={!preview}
          onPress={() => toast.info(t.demoNotice)}
        >
          <IconArrowUp aria-hidden="true" size={18} />
        </Button>
      </div>
    </section>
  );
}
