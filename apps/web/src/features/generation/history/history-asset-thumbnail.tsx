import { IconPhotoOff } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { AssetImage } from "../asset-image";

/** 历史栏与预览列表共享原比例缩略图和加载失败占位。 */
export function HistoryAssetThumbnail({ assetId, alt }: { assetId: string; alt: string }) {
  return (
    <span className="history-thumbnail-frame">
      <AssetImage
        assetId={assetId}
        thumbnail
        alt={alt}
        loading="lazy"
        fallback={
          <UiIcon icon={IconPhotoOff} size="action" className="history-thumbnail-unavailable" />
        }
      />
    </span>
  );
}
