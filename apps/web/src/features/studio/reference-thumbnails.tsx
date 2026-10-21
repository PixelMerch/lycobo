import { Link } from "@heroui/react";
import { assetContentUrl } from "./generation-client";

/** Reference images used by a task, each opening its full-size asset. */
export function ReferenceThumbnails({ ids, label }: { ids: string[]; label?: string }) {
  if (ids.length === 0) return null;
  return (
    <section className="generation-output-thumbnails" aria-label={label}>
      {ids.map((id, index) => (
        <Link
          key={id}
          className="generation-output-thumbnail"
          href={assetContentUrl(id)}
          target="_blank"
          rel="noreferrer"
          aria-label={`查看参考图片 ${index + 1}`}
        >
          <img
            src={assetContentUrl(id, true)}
            alt={`参考图片 ${index + 1} 缩略图`}
            loading="lazy"
          />
        </Link>
      ))}
    </section>
  );
}
