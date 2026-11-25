import { Modal } from "@heroui/react";
import type { AssetTool } from "@lycoboai/contracts";
import { motion } from "motion/react";
import { useState } from "react";
import { DialogClose } from "../../components/overlays/dialog-close";
import { useCenteredDialogEntrance } from "../../components/overlays/use-centered-dialog-entrance";
import "../../styles/fullscreen-dialog.css";
import { HomeInspirationGallery } from "../inspiration/home-inspiration-gallery";
import { AssetBrowser } from "./asset-browser";
import { toolAssetFilters } from "./asset-library-client";
import { type AssetLibraryTab, AssetLibraryTabs } from "./asset-library-tabs";
import "./library-dialog.css";
import { useMessages } from "../../i18n/messages";
import { assetsMessages } from "./assets-messages";

/**
 * 工作区打开的全屏素材库：我的素材默认看当前功能生成的素材，灵感库点“做同款”后关闭弹窗回到工作台。
 * 多选时 Esc 先退出多选，再按一次才关闭弹窗。
 */
export function LibraryDialog({
  tool,
  initialTab = "mine",
  onClose,
}: {
  tool?: AssetTool | undefined;
  initialTab?: AssetLibraryTab;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState(() => toolAssetFilters(tool));
  const [tab, setTab] = useState<AssetLibraryTab>(initialTab);
  const [selecting, setSelecting] = useState(false);
  const t = useMessages(assetsMessages);
  const surfaceMotion = useCenteredDialogEntrance();
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop
        className="fullscreen-dialog__backdrop library-backdrop"
        isKeyboardDismissDisabled={selecting}
      >
        <Modal.Container size="full" className="fullscreen-dialog__container">
          <Modal.Dialog className="library-dialog" aria-label={t.libraryTitle}>
            <motion.div className="library-shell" {...surfaceMotion}>
              <AssetLibraryTabs
                tab={tab}
                floatingScrollbar
                onTabChange={setTab}
                endAction={
                  <DialogClose fullScreen label={t.closeLibrary} className="library-close" />
                }
                mine={
                  <AssetBrowser
                    filters={filters}
                    currentTool={tool}
                    headingLevel={3}
                    onChange={setFilters}
                    onViewHistory={onClose}
                    onSelectingChange={setSelecting}
                  />
                }
                inspiration={<HomeInspirationGallery onApplied={onClose} />}
              />
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
