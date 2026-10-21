import { Button, EmptyState, ListBox, Modal, Select } from "@heroui/react";
import { IconPhoto } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { assetContentUrl, useImageAssets } from "./generation-client";
import { ImagePreviewDialog, type PreviewImage } from "./image-preview";
import "./fullscreen-dialog.css";
import "./library-dialog.css";

type KindFilter = "all" | "output" | "reference";

const kinds: Array<{ id: KindFilter; label: string }> = [
  { id: "all", label: "全部类型" },
  { id: "output", label: "生成图片" },
  { id: "reference", label: "参考图片" },
];

/** Asset library drawer opened from the workspace history rail. */
export function LibraryDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [model, setModel] = useState("all");
  const [phase, setPhase] = useState<"open" | "closed">("open");
  const [preview, setPreview] = useState<{ images: PreviewImage[]; index: number } | null>(null);
  const reduceMotion = useReducedMotion();
  const query = useImageAssets();
  useErrorToast(query.isError ? query.error.message : null);
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  const modelOptions = [
    ...new Set(assets.map((asset) => asset.model).filter((value): value is string => !!value)),
  ].sort();
  const visible = assets.filter(
    (asset) =>
      (kind === "all" || asset.kind === kind) && (model === "all" || asset.model === model),
  );
  // Dismissal collapses the surface back to the centre first; only then does the
  // modal unmount and hand focus back to the rail entry.
  const requestClose = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    setPhase("closed");
  };
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <Modal.Backdrop className="fullscreen-dialog__backdrop library-backdrop">
        <Modal.Container size="full" className="fullscreen-dialog__container">
          <Modal.Dialog className="library-dialog" aria-label="资产管理">
            <motion.div
              className="library-shell"
              initial={reduceMotion ? false : "closed"}
              animate={phase}
              variants={{
                // Slides in from the right edge. Dismissal slides the opaque panel
                // fully off-screen (no fade) so the workspace is never seen through
                // a translucent surface; the modal unmounts only after it has left.
                open: {
                  x: "0%",
                  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                },
                closed: {
                  x: "100%",
                  transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
                },
              }}
              onAnimationComplete={() => {
                if (phase === "closed") onClose();
              }}
            >
              <Modal.Header className="library-header">
                <DialogClose label="关闭资产管理" className="library-close" />
                <Modal.Heading>资产管理</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="library-body">
                <div className="library-filters">
                  <Select
                    className="library-filter"
                    aria-label="图片类型"
                    value={kind}
                    onChange={(key) => {
                      if (key === "all" || key === "output" || key === "reference") setKind(key);
                    }}
                  >
                    <Select.Trigger className="library-filter-trigger">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="model-menu" placement="bottom start">
                      <ListBox aria-label="图片类型">
                        {kinds.map((entry) => (
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
                            textValue={entry}
                          >
                            <span>{entry}</span>
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                {query.isPending ? null : query.isError ? null : visible.length ? (
                  <>
                    <div className="library-grid">
                      {visible.map((asset, index) => (
                        <Button
                          variant="tertiary"
                          className="library-tile"
                          key={asset.id}
                          aria-label={`查看图片：${asset.prompt ?? "参考图片"}`}
                          style={{ animationDelay: `${Math.min(index, 18) * 24}ms` }}
                          onPress={() =>
                            setPreview({
                              index,
                              images: visible.map((image) => ({
                                id: image.id,
                                publicId: image.public_id,
                                width: image.width,
                                height: image.height,
                                meta: {
                                  model: image.model,
                                  createdAt: image.created_at,
                                  prompt: image.prompt,
                                },
                              })),
                            })
                          }
                        >
                          <img
                            src={assetContentUrl(asset.id, true)}
                            alt={asset.prompt ?? "素材图片"}
                            loading="lazy"
                          />
                          {asset.model && (
                            <span className="model-tag library-tile-badge">
                              <span>{asset.model}</span>
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                    {query.hasNextPage && (
                      <Button
                        variant="secondary"
                        className="library-more"
                        isDisabled={query.isFetchingNextPage}
                        onPress={() => {
                          void query.fetchNextPage();
                        }}
                      >
                        加载更多素材
                      </Button>
                    )}
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
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
