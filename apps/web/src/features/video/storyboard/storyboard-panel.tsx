import { Button, Spinner, ToggleButton } from "@heroui/react";
import { imageUnitCredits, storyboardVideoShotLimit, videoUnitCredits } from "@lycoboai/contracts";
import { IconArrowLeft, IconArrowRight, IconRefresh } from "@tabler/icons-react";
import { lazy, Suspense, useState } from "react";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { assetContentUrl } from "../../generation/asset-delivery-client";
import { AssetImage } from "../../generation/asset-image";
import type { useStoryboard } from "./use-storyboard";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer").then((module) => ({ default: module.ImageViewer })),
);

type Flow = ReturnType<typeof useStoryboard>;

export function StoryboardPanel({ flow }: { flow: Flow }) {
  const [confirm, setConfirm] = useState<"video" | "reset" | { shot: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { draft, shots, selected, busy } = flow;
  const previews = preview
    ? shots.flatMap(({ image, title }) =>
        image
          ? [
              {
                id: image,
                src: assetContentUrl(image),
                thumbnailSrc: assetContentUrl(image, true),
                alt: title,
              },
            ]
          : [],
      )
    : [];
  const previewIndex = previews.findIndex((image) => image.id === preview);
  const { progress } = draft;
  const ready =
    selected.length > 0 &&
    selected.length <= storyboardVideoShotLimit &&
    selected.every((shot) => shot.image && !shot.pending && !shot.uncertain);
  const canSubmit = !busy && !flow.blockedVideo && (flow.pendingVideo || (ready && flow.canVideo));
  const move = (from: number, offset: number) => {
    const to = from + offset;
    const shot = shots[from];
    if (!shot || to < 0 || to >= shots.length) return;
    const order = shots.map((item) => item.id);
    order.splice(from, 1);
    order.splice(to, 0, shot.id);
    flow.save({ order });
  };
  const locked = busy || flow.ownImagePending || flow.pendingVideo;
  const notice =
    flow.action === "video"
      ? "正在优化提示词并提交视频…"
      : flow.action === "plan"
        ? flow.plan
          ? "正在提交分镜图…"
          : "正在规划分镜…"
        : flow.action
          ? "正在提交重做…"
          : null;
  return (
    <div className="storyboard-panel">
      <header className="storyboard-panel-header">
        <div>
          <h2>TK 分镜创作</h2>
          <p>
            {shots.length
              ? `已选 ${selected.length} 张 · 商品原图随视频提交`
              : "上传商品图并写一句想法，先看分镜，再生成视频。"}
          </p>
        </div>
        <div className="storyboard-controls">
          {progress.planId && (
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={locked || shots.some((shot) => shot.pending && !flow.jobError)}
              onPress={() => setConfirm("reset")}
            >
              新建分镜
            </Button>
          )}
          <Button size="sm" variant="tertiary" onPress={() => flow.update({ showPanel: false })}>
            查看视频历史
          </Button>
        </div>
      </header>
      {notice && (
        <p className="storyboard-status" role="status">
          <Spinner size="sm" />
          {notice}
        </p>
      )}
      {flow.jobError && (
        <Button size="sm" variant="secondary" onPress={flow.refreshJobs}>
          刷新分镜状态
        </Button>
      )}
      {!!shots.length && (
        <ol className="storyboard-shots" aria-label="分镜顺序">
          {shots.map((shot, index) => (
            <li key={shot.id} className="storyboard-shot">
              <div className="storyboard-shot-image">
                {shot.image && (
                  <Button
                    variant="ghost"
                    className="storyboard-shot-preview"
                    aria-label={`查看第 ${index + 1} 张分镜图`}
                    onPress={() => setPreview(shot.image)}
                  >
                    <AssetImage assetId={shot.image} thumbnail alt={shot.title} loading="lazy" />
                  </Button>
                )}
                {shot.pending && <Spinner size="sm" aria-label="正在生成分镜图" />}
                {!shot.image && !shot.pending && (
                  <span>
                    {shot.uncertain ? "结果待核对" : shot.failed ? "出图失败" : "等待出图"}
                  </span>
                )}
              </div>
              <div className="storyboard-shot-copy">
                <div className="storyboard-shot-title">
                  <strong>
                    {String(index + 1).padStart(2, "0")} · {shot.title}
                  </strong>
                  <ToggleButton
                    size="sm"
                    variant="ghost"
                    isSelected={shot.selected}
                    aria-label={`第 ${index + 1} 张分镜入片`}
                    isDisabled={
                      locked || (!shot.selected && selected.length >= storyboardVideoShotLimit)
                    }
                    onChange={(checked) =>
                      flow.save({
                        excluded: checked
                          ? progress.excluded.filter((id) => id !== shot.id)
                          : [...progress.excluded, shot.id],
                      })
                    }
                  >
                    入片
                  </ToggleButton>
                </div>
                <p title={shot.prompt}>{shot.prompt}</p>
                {shot.image && (shot.failed || shot.uncertain) && (
                  <p role="status">
                    {shot.uncertain ? "重做结果待核对" : "重做未完成，已保留原图"}
                  </p>
                )}
              </div>
              <div className="storyboard-controls">
                <Button
                  isIconOnly
                  size="sm"
                  variant="tertiary"
                  aria-label={`前移第 ${index + 1} 张`}
                  isDisabled={locked || index === 0}
                  onPress={() => move(index, -1)}
                >
                  <UiIcon icon={IconArrowLeft} size="small" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="tertiary"
                  aria-label={`后移第 ${index + 1} 张`}
                  isDisabled={locked || index === shots.length - 1}
                  onPress={() => move(index, 1)}
                >
                  <UiIcon icon={IconArrowRight} size="small" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="tertiary"
                  aria-label={`重做第 ${index + 1} 张，${imageUnitCredits} 积分`}
                  isDisabled={
                    locked ||
                    flow.pendingImage ||
                    !flow.canDraw ||
                    !progress.batchId ||
                    shot.pending ||
                    shot.uncertain
                  }
                  onPress={() => setConfirm({ shot: shot.id })}
                >
                  <UiIcon icon={IconRefresh} size="small" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {flow.blockedVideo && <p>请切换到直接生成确认上次视频提交。</p>}
      {(shots.length > 0 || flow.pendingVideo) && (
        <footer className="storyboard-footer">
          <span>9:16 · {draft.seconds} 秒</span>
          <Button
            variant="primary"
            size="lg"
            className="primary-action generation-submit"
            isDisabled={!canSubmit}
            isPending={flow.action === "video"}
            onPress={() => (flow.pendingVideo ? flow.start("video") : setConfirm("video"))}
          >
            {flow.pendingVideo ? "确认上次视频提交" : "生成视频"}
            <span className="generate-credit-cost">
              <CreditCoin size="default" />
              {videoUnitCredits}
            </span>
          </Button>
        </footer>
      )}
      {previewIndex >= 0 && (
        <Suspense fallback={null}>
          <ImageViewer
            images={previews}
            initialIndex={previewIndex}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
      <ConfirmDialog
        isOpen={confirm !== null}
        title={
          confirm === "video"
            ? "按当前分镜生成视频？"
            : confirm === "reset"
              ? "新建分镜？"
              : "重做这张分镜图？"
        }
        content={
          confirm === "video"
            ? `将根据选中的分镜优化提示词，视频提交消耗 ${videoUnitCredits} 积分。`
            : confirm === "reset"
              ? "已生成的图片可在素材库查看。"
              : `本次出图消耗 ${imageUnitCredits} 积分，生成成功后替换当前图片。`
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const next = confirm;
          setConfirm(null);
          if (next === "reset") flow.reset();
          else if (next === "video" && canSubmit) flow.start("video");
          else if (next && typeof next === "object" && !locked) flow.start(next);
        }}
      />
    </div>
  );
}
