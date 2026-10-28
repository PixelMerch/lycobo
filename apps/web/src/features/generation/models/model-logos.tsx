import { imageModelLogosResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import { IconPhoto } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";

export function useModelPresentation() {
  return useQuery({
    queryKey: ["image-model-logos"],
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/v1/image-model-logos", {
        signal,
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("模型图标暂时不可用");
      return imageModelLogosResponseSchema.parse(unwrapApiData(await response.json()));
    },
  });
}

export function ModelLogo({ src }: { src: string | null | undefined }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return src && failedUrl !== src ? (
    <img
      className="creation-model-logo"
      src={src}
      width="64"
      height="64"
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setFailedUrl(src)}
    />
  ) : (
    <span className="creation-model-logo creation-model-logo-fallback" aria-hidden="true">
      <UiIcon icon={IconPhoto} />
    </span>
  );
}
