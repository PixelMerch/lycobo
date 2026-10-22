import { Button } from "@heroui/react";
import { IconArrowLeft, IconPlus, IconSparkles } from "@tabler/icons-react";
import { CreditCoin } from "../../components/credit-coin";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import type { PreviewImage } from "./image-preview";
import { RepairRegionCard } from "./repair-region-card";
import type { LocalRepairEditor } from "./use-local-repair";
import "./local-repair.css";

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
      aria-label="局部编辑设置"
    >
      <div className="image-preview-close-row">
        <DialogClose fullScreen label="关闭图片预览" className="image-preview-close" />
      </div>
      <header>
        <Button variant="ghost" size="sm" className="repair-back" onPress={onBack}>
          <UiIcon icon={IconArrowLeft} />
          返回详情
        </Button>
        <h2>修改图片</h2>
        <p className="repair-lead">框选位置，描述你想修改的内容</p>
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
          添加区域
        </Button>
      </div>
      <div className="repair-submit">
        {!available && models.isSuccess && (
          <p className="repair-message">当前模型暂不支持此规格的图片编辑。</p>
        )}
        {pending && !ownPending && <p className="repair-message">请先在原提交入口确认上次提交。</p>}
        {/* Task progress is announced in the bottom-right notice, not here. */}
        {/* Same action shape as the composer: label plus the credit token, so the
         * cost is read at submission instead of in a separate billing row. */}
        <Button
          fullWidth
          variant="primary"
          className="repair-generate"
          isPending={generate.isPending}
          isDisabled={!available || !image || busy || !canGenerate || (pending && !ownPending)}
          onPress={() => void submit()}
        >
          <UiIcon icon={IconSparkles} />
          {ownPending ? "确认上次提交" : busy ? "生成中…" : "立即生成"}
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
            查看修改版
          </Button>
        )}
      </div>
    </aside>
  );
}
