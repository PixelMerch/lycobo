import { Button, Spinner } from "@heroui/react";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { CreditCoin } from "../../../components/credit-coin";
import { DialogClose } from "../../../components/overlays/dialog-close";
import { UiIcon } from "../../../components/ui-icon";
import type { PreviewImage } from "../image-preview";
import { RepairRegionCard } from "./repair-region-card";
import type { LocalRepairEditor } from "./use-local-repair";
import "./local-repair.css";
import { useMessages } from "../../../i18n/messages";
import { imageWorkspaceMessages } from "../image-workspace-messages";

/** 局部编辑面板：框选区域并填写修改说明，确认后生成修改版。 */
export function LocalRepairPanel({
  source,
  editor,
  onBack,
  onPreview,
}: {
  source: PreviewImage;
  editor: LocalRepairEditor;
  onBack: () => void;
  onPreview: (image: PreviewImage) => void;
}) {
  const t = useMessages(imageWorkspaceMessages);
  const {
    draft,
    image,
    models,
    available,
    busy,
    locked,
    pending,
    ownPending,
    canGenerate,
    job,
    result,
    generate,
    selected,
    setSelected,
    change,
    add,
    submit,
  } = editor;
  return (
    <aside
      className="image-preview-info repair-info image-preview-workspace-panel"
      aria-label={t.editSettings}
    >
      <div className="image-preview-close-row">
        <DialogClose fullScreen label={t.closePreview} className="image-preview-close" />
      </div>
      <header>
        <Button variant="ghost" size="sm" className="repair-back" onPress={onBack}>
          <UiIcon icon={IconArrowLeft} />
          {t.backToDetails}
        </Button>
        <h2>{t.editImage}</h2>
        <p className="repair-lead">{t.editLead}</p>
      </header>
      <div className="repair-regions">
        {draft.regions.map((region, index) => (
          <RepairRegionCard
            key={region.id}
            region={region}
            number={index + 1}
            selected={selected === region.id}
            locked={!!locked}
            onSelect={() => setSelected(region.id)}
            onRemove={() => change(draft.regions.filter((value) => value.id !== region.id))}
            onPrompt={(prompt) =>
              change(
                draft.regions.map((value) =>
                  value.id === region.id ? { ...value, prompt } : value,
                ),
              )
            }
          />
        ))}
        <Button
          fullWidth
          variant="tertiary"
          size="sm"
          className="repair-add"
          isDisabled={locked || !image || draft.regions.length >= 8}
          onPress={add}
        >
          <UiIcon icon={IconPlus} />
          {t.addRegion}
        </Button>
      </div>
      <div className="repair-submit">
        {!available && models.isSuccess && <p className="repair-message">{t.unsupported}</p>}
        {pending && !ownPending && <p className="repair-message">{t.confirmElsewhere}</p>}
        {/* 任务进度在右下角提示里播报，这里不重复。 */}
        {/* 与创作面板相同：文字加积分标记，提交时就能看到费用，不另起一行账单。 */}
        <Button
          fullWidth
          variant="primary"
          size="lg"
          className={`generation-submit repair-generate${busy ? " generation-pending" : ""}`}
          data-submitting={busy || undefined}
          isPending={generate.isPending}
          isDisabled={!available || !image || busy || !canGenerate || (pending && !ownPending)}
          onPress={() => void submit()}
        >
          {busy && <Spinner size="md" color="current" role="status" aria-label={t.generating} />}
          {ownPending ? t.confirmLastSubmission : t.generateNow}
          {!ownPending && !busy && models.data && (
            <span className="generate-credit-cost" aria-hidden="true">
              <CreditCoin />
              <span>{models.data.unitCredits}</span>
            </span>
          )}
        </Button>
        {result?.output_asset_id && (
          <Button
            variant="secondary"
            fullWidth
            className="repair-result"
            onPress={() => {
              if (!result.output_asset_id || !job.data) return;
              onPreview({
                id: result.output_asset_id,
                publicId: result.output_public_id,
                width: result.width,
                height: result.height,
                meta: {
                  taskId: job.data.id,
                  taskPublicId: job.data.public_id,
                  model: job.data.model,
                  prompt: job.data.prompt,
                  createdAt: job.data.created_at,
                  references: [source.id],
                },
              });
            }}
          >
            {t.viewEdited}
          </Button>
        )}
      </div>
    </aside>
  );
}
