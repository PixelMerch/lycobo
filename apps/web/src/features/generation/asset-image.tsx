import { imageDeliverySchema } from "@lycoboai/contracts";
import { useQuery } from "@tanstack/react-query";
import { type ComponentPropsWithRef, useRef } from "react";
import { assetContentUrl, deliveryKey } from "./asset-delivery-client";
import { imageRequest } from "./generation-client";
export function AssetImage({
  assetId,
  thumbnail = false,
  onError,
  alt,
  ...props
}: Omit<ComponentPropsWithRef<"img">, "src" | "alt"> & {
  assetId: string;
  thumbnail?: boolean;
  alt: string;
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
  return (
    <img
      {...props}
      alt={alt}
      crossOrigin="anonymous"
      referrerPolicy="strict-origin-when-cross-origin"
      src={src}
      onError={(event) => {
        onError?.(event);
        if (!query.isFetching && query.data && !refreshAttempted.current.has(assetId)) {
          refreshAttempted.current.add(assetId);
          void query.refetch();
        }
      }}
    />
  );
}
