import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { useMessages } from "../../../i18n/messages";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useRequireLogin } from "../../auth/login-prompt";
import { useSmartVariationDraft } from "../../commerce/smart-variation/smart-variation-state";
import { useStudioStore } from "../../generation/studio-state";
import { type CampaignFormat, campaignFormats, type FormatTool } from "./commerce-content";
import { sectionsMessages } from "./sections-messages";

const pendingKey = "lycobo:commerce:template";
const pendingTtl = 30 * 60 * 1000;

const toolPaths: Record<FormatTool, string> = {
  create: "/commerce/create",
  variation: "/commerce/smart-variation",
  replica: "/commerce/replica",
  textile: "/commerce/textile-set",
};

/** 未登录时记住本次模板，登录返回后继续同一次选择。 */
function rememberPending(format: CampaignFormat) {
  try {
    sessionStorage.setItem(pendingKey, JSON.stringify({ id: format.id, at: Date.now() }));
  } catch {
    // 隐私模式禁用存储时只保留登录门禁，不阻断流程。
  }
}

function takePending() {
  try {
    const raw = sessionStorage.getItem(pendingKey);
    if (!raw) return null;
    sessionStorage.removeItem(pendingKey);
    const saved: unknown = JSON.parse(raw);
    if (typeof saved !== "object" || saved === null) return null;
    if (!("id" in saved) || !("at" in saved)) return null;
    if (typeof saved.id !== "string" || typeof saved.at !== "number") return null;
    if (Date.now() - saved.at > pendingTtl) return null;
    return campaignFormats.find((format) => format.id === saved.id) ?? null;
  } catch {
    return null;
  }
}

/** 主图草稿已有内容且提示词不同，需要确认覆盖。 */
function createDraftConflict(prompt: string) {
  const { activeModel, drafts } = useStudioStore.getState();
  const draft = drafts[activeModel];
  const hasContent = Boolean(draft?.prompt.trim()) || (draft?.references.length ?? 0) > 0;
  return hasContent && draft?.prompt.trim() !== prompt.trim();
}

/** 套图草稿已有需求且内容不同，需要确认覆盖。 */
function variationDraftConflict(prompt: string) {
  const description = useSmartVariationDraft.getState().description.trim();
  return Boolean(description) && description !== prompt.trim();
}

/** 模板只把提示词与规格带入草稿；选择工具和登录门禁沿用现有工作区。 */
export function useTemplateRemix() {
  const t = useMessages(sectionsMessages).formats;
  const session = useEnterpriseSession();
  const requireLogin = useRequireLogin();
  const navigate = useAppNavigate();
  const [pending, setPending] = useState<CampaignFormat | null>(null);

  const apply = useCallback(
    (format: CampaignFormat) => {
      const prompt = t.prompts[format.id];
      if (format.action === "use" && format.tool === "create") {
        const { activeModel, updateDraft } = useStudioStore.getState();
        updateDraft(activeModel, {
          prompt,
          ...(format.ratio ? { ratio: format.ratio } : {}),
        });
      }
      if (format.action === "use" && format.tool === "variation") {
        useSmartVariationDraft.getState().update({
          description: prompt,
          ...(format.ratio ? { ratio: format.ratio } : {}),
        });
      }
      setPending(null);
      void navigate(toolPaths[format.tool]);
    },
    [navigate, t.prompts],
  );

  const prepare = useCallback(
    (format: CampaignFormat) => {
      const prompt = t.prompts[format.id];
      const conflict =
        format.action === "use" &&
        ((format.tool === "create" && createDraftConflict(prompt)) ||
          (format.tool === "variation" && variationDraftConflict(prompt)));
      if (conflict) {
        setPending(format);
        return;
      }
      apply(format);
    },
    [apply, t.prompts],
  );

  useEffect(() => {
    if (!session.data) return;
    const saved = takePending();
    if (saved) prepare(saved);
  }, [session.data, prepare]);

  function select(format: CampaignFormat) {
    if (!requireLogin()) {
      rememberPending(format);
      return;
    }
    prepare(format);
  }

  const dialog = (
    <ConfirmDialog
      isOpen={pending !== null}
      title={t.replaceTitle}
      content={t.replaceContent}
      confirmLabel={t.replaceConfirm}
      cancelLabel={t.keepCurrent}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        if (pending) apply(pending);
      }}
    />
  );
  return { select, dialog };
}
