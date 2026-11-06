import { Modal } from "@heroui/react";
import type { AssetTool } from "@lycoboai/contracts";
import { motion } from "motion/react";
import { useState } from "react";
import { DialogClose } from "../../components/dialog-close";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import "../../styles/fullscreen-dialog.css";
import { AssetBrowser } from "./asset-browser";
import { type AssetLibraryFilters, defaultAssetFilters } from "./asset-library-client";
import "./library-dialog.css";

/** 我的素材只展示生成素材，默认按当前工具筛选。 */
export function LibraryDialog({
  tool,
  onClose,
}: {
  tool?: AssetTool | undefined;
  onClose: () => void;
}) {
  const defaults: AssetLibraryFilters = {
    ...defaultAssetFilters,
    tool: tool ?? "all",
    ...(tool === "video" ? { type: "video" as const } : {}),
  };
  const [filters, setFilters] = useState(defaults);
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
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
                <AssetBrowser
                  generatedOnly
                  filters={filters}
                  defaults={defaults}
                  currentTool={tool}
                  headingLevel={3}
                  onChange={setFilters}
                  onViewHistory={requestClose}
                />
              </Modal.Body>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
