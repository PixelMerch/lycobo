import { Button, TextArea } from "@heroui/react";
import { IconArrowUpRight, IconPlus, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { fetchCapabilities } from "../../lib/api";
import { useDraftStore } from "./draft-store";

export function CreatePage() {
  const prompt = useDraftStore((state) => state.prompt);
  const setPrompt = useDraftStore((state) => state.setPrompt);
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const capabilities = useQuery({
    queryKey: ["system", "capabilities"],
    queryFn: ({ signal }) => fetchCapabilities(signal),
  });
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  const statusText = capabilities.isPending
    ? "正在连接服务…"
    : capabilities.isError
      ? "暂时无法连接服务。"
      : "生图服务尚未启用，当前可预览参考图和编写描述。";
  return (
    <section aria-labelledby="create-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">商品图，从这里开始</p>
          <h1 id="create-title">开始创作</h1>
          <p>放入商品图，描述想要的效果。</p>
        </div>
        <Link className="text-link" to="/tasks">
          查看任务 <IconArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <div className="composer surface">
        <div className="composer-body">
          <div className="reference-area">
            {image ? (
              <div className="reference-preview">
                <img src={image.url} alt={image.name} />
                <Button
                  isIconOnly
                  variant="secondary"
                  className="remove-reference"
                  aria-label="移除参考图"
                  onPress={() => setImage(null)}
                >
                  <IconX size={16} aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Button
                className="upload-tile"
                variant="secondary"
                onPress={() => input.current?.click()}
              >
                <IconPlus size={26} aria-hidden="true" />
                <span>添加参考图</span>
              </Button>
            )}
            <input
              ref={input}
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="选择商品参考图"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (
                  !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
                  file.size > 10 * 1024 * 1024
                ) {
                  setError("请选择 10 MB 以内的 PNG、JPEG 或 WebP 图片。");
                  return;
                }
                setError("");
                setImage({ url: URL.createObjectURL(file), name: file.name });
              }}
            />
            <p className="field-hint">
              PNG / JPEG / WebP
              <br />
              仅本地预览，尚未上传
            </p>
          </div>
          <div className="prompt-area">
            <label htmlFor="prompt">画面描述</label>
            <TextArea
              id="prompt"
              rows={6}
              fullWidth
              maxLength={2000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：商品放在夏日泳池边，通透自然光，保留包装与文字。"
            />
            <span className="character-count">{prompt.length} / 2000</span>
          </div>
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="composer-footer">
          <span className="field-hint" role="status">
            {statusText}
          </span>
          <Button isDisabled className="generate-button">
            生成图片 <IconArrowUpRight size={18} aria-hidden="true" />
          </Button>
        </div>
        {capabilities.isError ? (
          <Button
            variant="tertiary"
            onPress={() => {
              void capabilities.refetch();
            }}
          >
            重新连接
          </Button>
        ) : null}
      </div>
      <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading">
          <h2 id="recent-title">最近任务</h2>
          <Link className="text-link" to="/tasks">
            全部任务 <IconArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="surface empty-state">
          <IconPlus size={26} aria-hidden="true" />
          <h3>还没有可查看的任务</h3>
          <p>接入生图服务后，任务进度与生成结果会显示在这里。</p>
        </div>
      </section>
    </section>
  );
}
