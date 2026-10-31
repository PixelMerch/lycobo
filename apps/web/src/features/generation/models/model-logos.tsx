import { IconPhoto } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { modelPresentation } from "./model-presentation";
import "./model-logos.css";

export function useModelPresentation() {
  return useQuery({
    queryKey: ["image-model-logos"],
    staleTime: Infinity,
    initialData: modelPresentation,
    queryFn: async () => modelPresentation,
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
