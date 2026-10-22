import { Button, FieldError, Input, TextArea, TextField } from "@heroui/react";
import { IconArrowLeft, IconPlus, IconTrash } from "@tabler/icons-react";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { assetContentUrl } from "./generation-client";
import type { PreviewImage } from "./image-preview";
import { constrainRegion } from "./local-repair-state";
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
    width,
    height,
    output,
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
        <h2>局部修复</h2>
        <p>框选需要修改的位置，分别描述修改内容</p>
      </header>
      <div className="repair-source">
        <img src={assetContentUrl(source.id, true)} alt="当前原图" />
        <span>
          当前图片<small>{source.publicId ?? "原图"}</small>
        </span>
      </div>
      <h3>
        修改区域 <span>（{draft.regions.length}/8）</span>
      </h3>
      <div className="repair-regions">
        {draft.regions.map((region, index) => (
          <section
            className="repair-region-card"
            id={`repair-region-${region.id}`}
            key={region.id}
            data-selected={selected === region.id}
          >
            <div className="repair-region-heading">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`区域 ${index + 1}`}
                onPress={() => setSelected(region.id)}
              >
                <span className="repair-badge">{index + 1}</span>区域 {index + 1}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label={`删除区域 ${index + 1}`}
                isDisabled={locked}
                onPress={() => change(draft.regions.filter((value) => value.id !== region.id))}
              >
                <UiIcon icon={IconTrash} />
              </Button>
            </div>
            <TextField
              aria-label={`区域 ${index + 1} 修改说明`}
              value={region.prompt}
              isDisabled={locked}
              isInvalid={attempted && !region.prompt.trim()}
              onFocus={() => setSelected(region.id)}
              onChange={(prompt) =>
                change(
                  draft.regions.map((value) =>
                    value.id === region.id ? { ...value, prompt } : value,
                  ),
                )
              }
            >
              <TextArea rows={3} maxLength={900} placeholder="描述这个区域需要怎么修改…" />
              <FieldError>请填写这个区域的修改说明</FieldError>
            </TextField>
            {selected === region.id && (
              <div className="repair-coordinates">
                {(["x", "y", "width", "height"] as const).map((axis) => (
                  <TextField
                    key={axis}
                    aria-label={`区域 ${index + 1} ${{ x: "左", y: "上", width: "宽", height: "高" }[axis]}`}
                    isDisabled={locked}
                    value={String(Math.round(region[axis]))}
                    onChange={(value) => {
                      if (value === "" || !Number.isFinite(Number(value))) return;
                      change(
                        draft.regions.map((item) =>
                          item.id === region.id
                            ? constrainRegion({ ...item, [axis]: Number(value) }, width, height)
                            : item,
                        ),
                      );
                    }}
                  >
                    <span aria-hidden="true">
                      {{ x: "左", y: "上", width: "宽", height: "高" }[axis]}
                    </span>
                    <Input
                      type="number"
                      aria-label={`区域 ${index + 1} ${{ x: "左", y: "上", width: "宽", height: "高" }[axis]}`}
                    />
                  </TextField>
                ))}
              </div>
            )}
          </section>
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
        {!draft.regions.length && <p>在图片上拖动框选，或点击添加区域。</p>}
      </div>
      <div className="repair-submit">
        <p>尽量保留选区外内容，实际效果以生成结果为准。</p>
        <div className="repair-output">
          <span>输出</span>
          <span>
            1 张 · {output.resolution} · {output.ratio}
          </span>
        </div>
        <small>
          {model} · {models.data?.unitCredits ?? 20} 币
        </small>
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
        <small>生成新版本，保留原图</small>
      </div>
    </aside>
  );
}
