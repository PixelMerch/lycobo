import { imageDeliverySchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
import { type ComponentPropsWithRef, type ReactNode, useRef, useState } from "react";
import { assetContentUrl, deliveryKey } from "./asset-delivery-client";
import { imageRequest } from "./generation-client";
import { clearPreviewLinks } from "./preview-link-cache";
/** 素材图片：签名链接过期时刷新一次；仍加载失败且传了 fallback 时，用它代替浏览器的破图。 */
export function AssetImage({
  assetId,
  thumbnail = false,
  onError,
  alt,
  fallback,
  onUnavailable,
  ...props
}: Omit<ComponentPropsWithRef<"img">, "src" | "alt"> & {
  assetId: string;
  thumbnail?: boolean;
  alt: string;
  fallback?: ReactNode;
  onUnavailable?: () => void;
}) {
  const refreshAttempted = useRef(new Set<string>());
  const query = useQuery({
    queryKey: deliveryKey(assetId),
    enabled: false,
    retry: false,
    queryFn: async ({ signal }) => {
      const data: unknown = await (
        await imageRequest(`image-assets/${assetId}/delivery`, { signal })
      ).json();
      return imageDeliverySchema.parse(
        data && typeof data === "object" && "delivery" in data ? data.delivery : null,
      );
    },
  });
  const src = assetContentUrl(assetId, thumbnail);
  // 记下加载失败的地址：链接刷新后地址变了，就重新显示图片。
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (fallback !== undefined && failedSrc === src) return fallback;
  return (
    <img
      {...props}
      alt={alt}
      crossOrigin="anonymous"
      referrerPolicy="strict-origin-when-cross-origin"
      src={src}
      onError={(event) => {
        onError?.(event);
        const failed = src;
        const markFailed = () => {
          setFailedSrc(failed);
          onUnavailable?.();
        };
        if (!query.isFetching && query.data && !refreshAttempted.current.has(assetId)) {
          refreshAttempted.current.add(assetId);
          clearPreviewLinks();
          // 刷新后地址没变（或刷新失败）时浏览器不会重新加载，也不会再报错，这里直接按失败处理。
          void query.refetch().then(() => {
            if (assetContentUrl(assetId, thumbnail) === failed) markFailed();
          });
          return;
        }
        markFailed();
      }}
    />
  );
}
