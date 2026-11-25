import { imageUnitCredits, publicImageResolutions } from "@lycoboai/contracts";
import { ReferencePrompt } from "../../../components/reference-prompt/reference-prompt";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { GenerateButton } from "../../generation/composer/generate-button";
import { ParameterGroup } from "../../generation/composer/parameter-group";
import { AspectRatioField } from "../../generation/composer/ratio-picker";
import {
  ImageApiError,
  pendingSubmissionSource,
  useGenerateImage,
  useImageModels,
  useImageSession,
  usePendingSubmission,
} from "../../generation/generation-client";
import { generationMessages } from "../../generation/generation-messages";
import { revealNewestHistory } from "../../generation/history/history-navigation";
import { modelCapabilities, supportsReferences } from "../../generation/models/model-capabilities";
import { WorkspaceComposerTitle } from "../../workspace/workspace-tool-symbol";
import { replicaMessages } from "./replica-messages";
import { ReplicaReferences } from "./replica-references";
import {
  replicaModel,
  replicaProductLimit,
  shiftReplicaPromptReferences,
  useReplicaDraft,
} from "./replica-state";

/** 复制目标图的视觉风格，沿用现有素材上传、幂等提交、队列与计费链路。 */
export function ReplicaPage() {
  const state = useReplicaDraft();
  const { draft, target, products, update } = state;
  const t = useMessages(replicaMessages);
  const common = useMessages(generationMessages);
  const models = useImageModels();
  const session = useImageSession();
  const generate = useGenerateImage({ successFeedback: "button" });
  const anyPending = usePendingSubmission(session.data);
  const pending =
    anyPending && !!session.data && pendingSubmissionSource(session.data) === "replica";
  const capabilities = modelCapabilities(models.data, replicaModel, "replica");
  const valid =
    !!target &&
    products.length > 0 &&
    products.every((product) => product.id !== target.id) &&
    supportsReferences(capabilities, products.length + 1) &&
    capabilities?.enabledResolutions.some((value) => value === draft.resolution);
  const error = generate.error ?? models.error ?? session.error;
  const errorMessage = error instanceof ImageApiError ? error.message : common.serviceUnavailable;
  useErrorToast(error ? errorMessage : null);
  const patchDraft = (patch: Partial<typeof draft>) => update({ draft: { ...draft, ...patch } });
  const submit = useReplicaSubmission(state, generate, !!pending, !!valid);
  const isDisabled =
    !session.isSuccess || generate.isPending || (anyPending && !pending) || (!pending && !valid);
  const cost = imageUnitCredits * products.length;
  const showCost = !isDisabled && !pending && cost > 0;
  return (
    <section className="composer-panel" aria-label={t.parameters}>
      <section className="composer-scroll">
        <WorkspaceComposerTitle />
        <ReplicaReferences />
        <ReferencePrompt
          className="prompt-field"
          label={t.prompt}
          value={draft.prompt}
          onChange={(prompt) => patchDraft({ prompt })}
          references={products}
          maxReferences={replicaProductLimit}
          unavailableReferenceIds={target ? [target.id, target.assetId ?? target.id] : undefined}
          onReferencesInsert={(images, prompt) =>
            update({ products: [...products, ...images], draft: { ...draft, prompt } })
          }
          placeholder={t.placeholder}
          maxLength={5000}
          optimizeTool="create"
          showCount
          autoGrow
        />
        <AspectRatioField
          label={common.aspectRatio}
          value={draft.ratio}
          onChange={(ratio) => patchDraft({ ratio })}
        />
        <ParameterGroup
          label={common.resolution}
          values={publicImageResolutions}
          value={draft.resolution}
          disabledValues={publicImageResolutions.filter(
            (value) => !capabilities?.enabledResolutions.some((enabled) => enabled === value),
          )}
          onChange={(resolution) => patchDraft({ resolution })}
        />
      </section>
      <div className="generate-area">
        <GenerateButton
          label={pending ? common.confirmLastSubmission : t.generate}
          submitting={generate.isPending}
          isDisabled={isDisabled}
          submittingLabel={common.submitting}
          cost={showCost ? cost : undefined}
          costDescription={showCost ? common.runCost(cost) : undefined}
          onPress={submit}
        />
      </div>
    </section>
  );
}

/** 以固定角色与同一幂等链路提交，成功时只清理未被继续编辑的草稿。 */
function useReplicaSubmission(
  state: ReturnType<typeof useReplicaDraft.getState>,
  generate: ReturnType<typeof useGenerateImage>,
  pending: boolean,
  valid: boolean,
) {
  const { draft, target, products, update } = state;
  const t = useMessages(replicaMessages);
  return async () => {
    if (!pending && !valid) return false;
    await generate.mutateAsync(
      {
        model: replicaModel,
        source: "replica",
        replica: true,
        userPrompt: draft.prompt,
        referenceRoles: ["style", ...products.map(() => "product" as const)],
        draft: {
          ...draft,
          count: String(products.length),
          prompt: `${t.instruction}\n${shiftReplicaPromptReferences(draft.prompt, 1)}`,
          references: target ? [target, ...products] : [],
        },
      },
      {
        onSuccess: () => {
          // 提交期间继续编辑的草稿必须保留，不把新输入一起清空。
          if (
            !pending &&
            useReplicaDraft.getState().draft === draft &&
            useReplicaDraft.getState().target === target &&
            useReplicaDraft.getState().products === products
          )
            update({ target: null, products: [], draft: { ...draft, prompt: "" } });
          revealNewestHistory();
        },
      },
    );
    return true;
  };
}
