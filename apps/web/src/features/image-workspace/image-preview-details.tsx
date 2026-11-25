import { Button } from "@heroui/react";
import { IconBrandOpenai } from "@tabler/icons-react";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { AssetPreviewDetails } from "../assets/asset-preview-details";
import { displayPrompt } from "../generation/prompt-display";
import type { PreviewImage, PreviewMeta } from "./image-preview";
import { imageWorkspaceMessages } from "./image-workspace-messages";

/** 图片详情使用图片的提示词格式，并提供局部编辑入口。 */
export function ImagePreviewDetails({
  source,
  meta,
  modelName,
  onRepair,
}: {
  source: PreviewImage;
  meta: PreviewMeta;
  modelName: string;
  onRepair: () => void;
}) {
  const t = useMessages(imageWorkspaceMessages);
  const locale = useLocale();
  const prompt = meta.prompt ? displayPrompt(meta.prompt, locale) : meta.prompt;
  return (
    <AssetPreviewDetails
      asset={{ ...meta, id: source.id, prompt }}
      icon={IconBrandOpenai}
      title={modelName}
      labels={t}
    >
      <div className="image-preview-tools-footer">
        <Button
          id="open-local-repair"
          className="image-preview-edit-action"
          variant="secondary"
          size="md"
          onPress={onRepair}
        >
          {t.localEdit}
        </Button>
      </div>
    </AssetPreviewDetails>
  );
}
