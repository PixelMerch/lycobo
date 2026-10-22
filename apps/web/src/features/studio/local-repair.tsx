import { Button } from "@heroui/react";
import { IconArrowLeft, IconPlus, IconSparkles } from "@tabler/icons-react";
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
    model,
    models,
    available,
    busy,
    locked,
    pending,
    ownPending,
    attempted,
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
      aria-label="局部修复设置"
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
        <p>框选位置，描述你想修改的内容</p>
      </header>
      <div className="repair-regions">
        {draft.regions.map((region, index) => (
          <RepairRegionCard
            key={region.id}
            region={region}
            number={index + 1}
            selected={selected === region.id}
            locked={!!locked}
            attempted={attempted}
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
          variant="outline"
          size="sm"
          isDisabled={locked || !image || draft.regions.length >= 8}
          onPress={add}
        >
          <UiIcon icon={IconPlus} />
          添加区域
        </Button>
        {!draft.regions.length && <p>在图片上框选要修改的位置。</p>}
      </div>
      <div className="repair-submit">
        <div className="repair-billing">
          <span>{model}</span>
          <span>{models.data ? `${models.data.unitCredits} 积分` : "积分加载中…"}</span>
        </div>
        {!available && models.isSuccess && <p>当前模型暂不支持此规格的图片编辑。</p>}
        {pending && !ownPending && <p>请先在原提交入口确认上次提交。</p>}
        {attempted && !draft.regions.length && <p>请先添加需要修改的区域。</p>}
        {job.data && (
          <p aria-live="polite">
            {result
              ? "修改版已生成"
              : ["queued", "running"].includes(job.data.status)
                ? "修改版生成中，可返回详情继续查看图片。"
                : "修改版未能完成，请在历史记录查看任务与积分状态。"}
          </p>
        )}
        <Button
          fullWidth
          variant="primary"
          className="repair-generate"
          isPending={generate.isPending}
          isDisabled={!available || !image || busy || (pending && !ownPending)}
          onPress={() => void submit()}
        >
          <UiIcon icon={IconSparkles} />
          {ownPending ? "确认上次提交" : busy ? "修改版生成中…" : "生成修改版"}
        </Button>
        {result?.output_asset_id && (
          <Button
            variant="secondary"
            fullWidth
            onPress={() => {
              if (!result.output_asset_id || !job.data) return;
              onPreview({
                id: result.output_asset_id,
                publicId: result.output_public_id,
                width: result.width,
                height: result.height,
                meta: {
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
        <small className="repair-preserve">原图保留</small>
      </div>
    </aside>
  );
}
