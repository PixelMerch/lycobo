import { Button, TextArea, toast } from "@heroui/react";
import { IconArrowUp, IconPhotoPlus, IconSparkles } from "@tabler/icons-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { landingMessages } from "./landing-messages";

/** 首屏产品上传卡：选择本地产品图、填写场景描述，演示版不提交真实生成。 */
export function ProductUploadPanel() {
  const t = useMessages(landingMessages).hero;
  const [scene, setScene] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
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

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <section aria-label={t.uploadPhoto} className="lp-uploadPanel">
      <div className="lp-uploadTop">
        <label className="lp-uploadDrop" data-has-preview={Boolean(preview)}>
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-label={t.uploadPhoto}
            className="visually-hidden"
            onChange={selectFile}
            type="file"
          />
          {preview ? <img alt="" src={preview} /> : <IconPhotoPlus aria-hidden="true" size={24} />}
          <span>{preview ? t.replacePhoto : t.uploadPhoto}</span>
          <small>{t.uploadHint}</small>
        </label>
        <div className="lp-uploadFields">
          <label htmlFor="lp-scene-input">{t.sceneLabel}</label>
          <TextArea
            id="lp-scene-input"
            placeholder={t.scenePlaceholder}
            ref={textarea}
            value={scene}
            onChange={(event) => setScene(event.target.value)}
          />
        </div>
      </div>
      <div className="lp-uploadFooter">
        <span>{t.formats}</span>
        <Button
          className="lp-generateButton"
          isDisabled={!preview}
          onPress={() => toast.info(t.demoNotice)}
        >
          <IconSparkles aria-hidden="true" size={16} />
          {t.generateProduct}
          <IconArrowUp aria-hidden="true" size={16} />
        </Button>
      </div>
    </section>
  );
}
