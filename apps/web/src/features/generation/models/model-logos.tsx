import { IconPhoto } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { modelPresentationFor } from "./model-presentation";
import "./model-logos.css";

/** 模型展示资料：名称、Logo 与按当前语言的用途说明。 */
export function useModelPresentation() {
  const locale = useLocale();
  return useQuery({
    queryKey: ["image-model-logos", locale],
    staleTime: Infinity,
    initialData: modelPresentationFor(locale),
    queryFn: async () => modelPresentationFor(locale),
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
