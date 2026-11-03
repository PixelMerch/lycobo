import { Modal } from "@heroui/react";
import type { ImageTool } from "@lycoboai/contracts";
import { IconArrowUpRight } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useState } from "react";
import { DialogClose } from "../../components/dialog-close";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useCenteredDialogMotion } from "../../components/use-centered-dialog-motion";
import "../../styles/fullscreen-dialog.css";
import { AssetBrowser } from "./asset-browser";
import {
  type AssetLibraryFilters,
  defaultAssetFilters,
  filtersToSearch,
} from "./asset-library-client";
import "./library-dialog.css";

/**
 * 我的素材, opened from a tool's history rail: the 素材库 browser with the 功能 filter defaulting
 * to that tool. Filters stay local; “在素材库中查看” carries them to the page.
 */
export function LibraryDialog({
  tool,
  onClose,
}: {
  tool?: ImageTool | undefined;
  onClose: () => void;
}) {
  const defaults: AssetLibraryFilters = { ...defaultAssetFilters, tool: tool ?? "all" };
  const [filters, setFilters] = useState(defaults);
  const { phase, requestClose, surfaceMotion } = useCenteredDialogMotion(onClose);
  const search = filtersToSearch(filters).toString();
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
                <RouteLink
                  to={search ? `/assets?${search}` : "/assets"}
                  className="library-open-assets"
                >
                  在素材库中查看
                  <UiIcon icon={IconArrowUpRight} size="small" />
                </RouteLink>
              </Modal.Header>
              <Modal.Body className="library-body">
                <AssetBrowser
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
