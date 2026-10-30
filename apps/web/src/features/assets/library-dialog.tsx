import { Button, EmptyState, ListBox, Modal, Select } from "@heroui/react";
import { IconPhoto } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useState } from "react";
import { DialogClose } from "../../components/dialog-close";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import { useErrorToast } from "../../lib/error-toast";
import { AssetImage } from "../generation/asset-image";
import "../../styles/fullscreen-dialog.css";
import { useImageAssets } from "../generation/generation-client";
import { modelDisplayName } from "../generation/models/model-display-name";
import { useModelPresentation } from "../generation/models/model-logos";
import { ImagePreviewDialog, type PreviewImage } from "../image-workspace/image-preview";
import "./library-dialog.css";

type TypeFilter = "all" | "image";

const types: Array<{ id: TypeFilter; label: string }> = [
  { id: "all", label: "全部类型" },
  { id: "image", label: "图片" },
];

/** Asset library drawer opened from the workspace history rail. */
export function LibraryDialog({ onClose }: { onClose: () => void }) {
  const models = useModelPresentation().data?.models ?? [];
  const [type, setType] = useState<TypeFilter>("image");
  const [model, setModel] = useState("all");
  const [preview, setPreview] = useState<{
    images: PreviewImage[];
    index: number;
  } | null>(null);
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
  const query = useImageAssets({ kind: "output", type: type === "all" ? undefined : type });
  useErrorToast(query.isError ? query.error.message : null);
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  const modelOptions = [
    ...new Set(assets.map((asset) => asset.model).filter((value): value is string => !!value)),
  ].sort();
  const visible = assets.filter(
    (asset) =>
      asset.kind === "output" &&
      (type === "all" || asset.type === type) &&
      (model === "all" || asset.model === model),
  );
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Backdrop className="fullscreen-dialog__backdrop library-backdrop">
        <Modal.Container size="full" className="fullscreen-dialog__container">
          <Modal.Dialog className="library-dialog" aria-label="我的素材">
            <motion.div className="library-shell" data-dialog-phase={phase} {...surfaceMotion}>
              <Modal.Header className="library-header">
                <DialogClose fullScreen label="关闭我的素材" className="library-close" />
                <Modal.Heading>我的素材</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="library-body">
                <div className="library-filters">
                  <Select
                    className="library-filter"
                    aria-label="素材类型"
                    value={type}
                    onChange={(key) => {
                      if (key === "all" || key === "image") setType(key);
                    }}
                  >
                    <Select.Trigger className="library-filter-trigger">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="model-menu" placement="bottom start">
                      <ListBox aria-label="素材类型">
                        {types.map((entry) => (
                          <ListBox.Item
                            className="model-options"
                            key={entry.id}
                            id={entry.id}
                            textValue={entry.label}
                          >
                            <span>{entry.label}</span>
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Select
                    className="library-filter"
                    aria-label="生成模型"
                    value={model}
                    onChange={(key) => setModel(key === null ? "all" : String(key))}
                  >
                    <Select.Trigger className="library-filter-trigger">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="model-menu" placement="bottom start">
                      <ListBox aria-label="生成模型">
                        <ListBox.Item className="model-options" id="all" textValue="全部模型">
                          <span>全部模型</span>
                        </ListBox.Item>
                        {modelOptions.map((entry) => (
                          <ListBox.Item
                            className="model-options"
                            key={entry}
                            id={entry}
                            textValue={modelDisplayName(entry, models)}
                          >
                            <span>{modelDisplayName(entry, models)}</span>
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                {query.isPending ? null : query.isError && !query.data ? null : visible.length ? (
                  <>
                    <div className="library-grid">
                      {visible.map((asset, index) => (
                        <Button
                          variant="tertiary"
                          className="library-tile"
                          key={asset.id}
                          aria-label={`查看图片：${asset.prompt ?? "参考图片"}`}
                          style={{
                            animationDelay: `${Math.min(index, 18) * 24}ms`,
                          }}
                          onPress={() =>
                            setPreview({
                              index,
                              images: visible.map((image) => ({
                                id: image.id,
                                publicId: image.public_id,
                                width: image.width,
                                height: image.height,
                                meta: {
                                  taskPublicId: image.task_public_id,
                                  model: image.model,
                                  createdAt: image.created_at,
                                  prompt: image.prompt,
                                },
                              })),
                            })
                          }
                        >
                          <AssetImage
                            assetId={asset.id}
                            thumbnail
                            alt={asset.prompt ?? "素材图片"}
                            loading="lazy"
                          />
                          {asset.model && (
                            <span className="model-tag library-tile-badge">
                              <span>{modelDisplayName(asset.model, models)}</span>
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                    <InfiniteLoad
                      hasMore={query.hasNextPage}
                      isLoading={query.isFetchingNextPage}
                      isError={query.isError}
                      onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
                    />
                  </>
                ) : (
                  <EmptyState className="empty-state library-empty">
                    <UiIcon icon={IconPhoto} size="illustration" />
                    <h2>还没有素材</h2>
                    <p>生成成功的图片会自动保存在这里。</p>
                  </EmptyState>
                )}
              </Modal.Body>
            </motion.div>
            {preview && (
              <ImagePreviewDialog
                images={preview.images}
                initialIndex={preview.index}
                onClose={() => setPreview(null)}
                onViewHistory={requestClose}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
