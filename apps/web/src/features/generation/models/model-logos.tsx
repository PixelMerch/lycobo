import { imageModelLogosResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import { IconPhoto } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import "./model-logos.css";

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

export function ModelLogo({
  src,
  size = "navigation",
}: {
  src: string | null | undefined;
  size?: "navigation" | "compact";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const className = `creation-model-logo${size === "compact" ? " model-selector-logo" : ""}`;
  const dimension = size === "compact" ? 18 : 64;
  return src && failedUrl !== src ? (
    <img
      className={className}
      src={src}
      width={dimension}
      height={dimension}
      alt=""
      decoding="async"
      draggable={false}
      onError={() => setFailedUrl(src)}
    />
  ) : (
    <span className={`${className} creation-model-logo-fallback`} aria-hidden="true">
      <UiIcon icon={IconPhoto} />
    </span>
  );
}
