import { Button, Spinner } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { CreditCoin } from "../../../components/credit-coin";
import { ReferencePrompt } from "../../../components/reference-prompt/reference-prompt";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { ParameterGroup } from "../../generation/composer/parameter-group";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
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
import { ModelSelect } from "../../generation/models/model-select";
import { WorkspaceComposerTitle } from "../../workspace/workspace-tool-symbol";
import { replicaMessages } from "./replica-messages";
import { ReplicaReferences } from "./replica-references";
import { useReplicaDraft } from "./replica-state";

/** 复制目标图的视觉风格，沿用现有素材上传、幂等提交、队列与计费链路。 */
export function ReplicaPage() {
  const state = useReplicaDraft();
  const { model, draft, target, product, update } = state;
  const t = useMessages(replicaMessages);
  const common = useMessages(generationMessages);
  const models = useImageModels();
  const session = useImageSession();
  const generate = useGenerateImage();
  const anyPending = usePendingSubmission(session.data);
  const pending =
    anyPending && !!session.data && pendingSubmissionSource(session.data) === "replica";
  const capabilities = modelCapabilities(models.data, model, "create");
  const valid =
    !!target &&
    !!product &&
    target.id !== product.id &&
    supportsReferences(capabilities, 2) &&
    capabilities?.enabledResolutions.some((value) => value === draft.resolution);
  const error = generate.error ?? models.error ?? session.error;
  const errorMessage = error instanceof ImageApiError ? error.message : common.serviceUnavailable;
  useErrorToast(error ? errorMessage : null);
  const patchDraft = (patch: Partial<typeof draft>) => update({ draft: { ...draft, ...patch } });
  const submit = useReplicaSubmission(state, generate, !!pending, !!valid);
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
          references={[]}
          placeholder={t.placeholder}
          maxLength={5000}
          showCount
          autoGrow
        />
        <section className="parameter-group ratio-group" aria-label={common.aspectRatio}>
          <div className="ratio-heading">
            <h2>{common.aspectRatio}</h2>
            <span>{draft.ratio}</span>
          </div>
          <HomeRatioPicker value={draft.ratio} onChange={(ratio) => patchDraft({ ratio })} />
        </section>
        <ParameterGroup
          label={common.resolution}
          values={["1.5K", "2K", "4K"]}
          value={draft.resolution}
          selectionId="replica-resolution"
          disabledValues={["1.5K", "2K", "4K"].filter(
            (value) => !capabilities?.enabledResolutions.some((enabled) => enabled === value),
          )}
          onChange={(resolution) => patchDraft({ resolution })}
        />
        <ParameterGroup
          label={common.imageCount}
          values={["1", "2", "3", "4"]}
          value={draft.count}
          selectionId="replica-count"
          onChange={(count) => patchDraft({ count })}
        />
      </section>
      <div className="generate-area">
        <ModelSelect
          value={model}
          onChange={(next) => update({ model: next, draft: { ...draft, resolution: "1.5K" } })}
        />
        <Button
          className="primary-action generation-submit"
          variant="primary"
          size="lg"
          fullWidth
          isDisabled={
            !session.isSuccess ||
            generate.isPending ||
            (anyPending && !pending) ||
            (!pending && !valid)
          }
          isPending={generate.isPending}
          onPress={submit}
        >
          {generate.isPending ? <Spinner size="sm" /> : null}
          {pending ? common.confirmLastSubmission : t.generate}
          {!pending && (
            <>
              <CreditCoin />
              <span>{imageUnitCredits * Number(draft.count)}</span>
            </>
          )}
        </Button>
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
  const { model, draft, target, product, update } = state;
  const t = useMessages(replicaMessages);
  const submit = () => {
    if (!pending && !valid) return;
    generate.mutate(
      {
        model,
        source: "replica",
        replica: true,
        referenceRoles: ["style", "product"],
        draft: {
          ...draft,
          prompt: `${t.instruction}\n${draft.prompt}`,
          references: target && product ? [target, product] : [],
        },
      },
      {
        onSuccess: () => {
          // 提交期间继续编辑的草稿必须保留，不把新输入一起清空。
          if (
            !pending &&
            useReplicaDraft.getState().draft === draft &&
            useReplicaDraft.getState().target === target &&
            useReplicaDraft.getState().product === product
          )
            update({ target: null, product: null, draft: { ...draft, prompt: "" } });
          revealNewestHistory();
        },
      },
    );
  };
  return submit;
}
