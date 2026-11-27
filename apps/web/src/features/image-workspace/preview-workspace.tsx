import { Button, Slider } from "@heroui/react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { componentsMessages } from "../../components/components-messages";
import { MediaSkeleton } from "../../components/data-skeleton";
import { AssetImage } from "../generation/asset-image";
import { modelDisplayName } from "../generation/models/model-display-name";
import { useModelPresentation } from "../generation/models/model-logos";
import type { PreviewImage, PreviewMeta } from "./image-preview";
import { ImagePreviewDetails } from "./image-preview-details";
import { LocalRepairPanel } from "./local-edit/local-repair";
import { RepairCanvas } from "./local-edit/repair-canvas";
import { RepairNoticeRegion, useRepairNotice } from "./local-edit/repair-notice";
import { useLocalRepair } from "./local-edit/use-local-repair";
import { PreviewCanvasToolbar } from "./preview-canvas-toolbar";
import { PreviewDotGrid } from "./preview-dot-grid";
import { previewDefaultZoom, previewMinZoom, usePreviewZoom } from "./use-preview-zoom";
import "./preview-workspace.css";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { displayPrompt } from "../generation/prompt-display";
import { imageWorkspaceMessages } from "./image-workspace-messages";

/** 图片预览工作区：图片、视口与工具坞常驻，只切换右侧属性面板。 */
export default function PreviewWorkspace({
  source,
  meta,
  repairing,
  onRepairChange,
  onPreview,
}: {
  source: PreviewImage;
  meta: PreviewMeta;
  repairing: boolean;
  onRepairChange: (repairing: boolean) => void;
  onPreview: (image: PreviewImage) => void;
}) {
  const t = useMessages(imageWorkspaceMessages);
  const catalog = useModelPresentation();
  const locale = useLocale();
  const editor = useLocalRepair(source, repairing ? "rect" : "select");
  const { zoom, setZoom, wheelZoom } = usePreviewZoom();
  /* 任务进度在右下角提示里播报，表单里只留输入和提交。 */
  useRepairNotice({
    jobId: editor.draft.jobId,
    status: editor.job.data?.status,
    succeeded: !!editor.result,
  });
  const { stage, tool, pan, setPan, dragging, startPan, movePan, endPan } = usePreviewPan(
    editor.tool,
    repairing,
    wheelZoom,
  );
  const zoomed = zoom > 100;
  const enterRepair = () => {
    editor.setTool("rect");
    onRepairChange(true);
  };
  const leaveRepair = () => {
    editor.setTool("select");
    onRepairChange(false);
    requestAnimationFrame(() =>
      document.getElementById("open-local-repair")?.focus({ preventScroll: true }),
    );
  };
  const fit = () => {
    setZoom(previewDefaultZoom);
    setPan({ x: 0, y: 0 });
  };
  const size = source.width && source.height ? `${source.width} x ${source.height}` : t.sizePending;
  return (
    <>
      <section
        className="image-preview-stage preview-canvas-stage preview-dot-surface"
        aria-label={t.preview}
        ref={stage}
      >
        <PreviewDotGrid stage={stage} />
        <PreviewCanvasToolbar
          editor={editor}
          repairing={repairing}
          onTool={(next) => {
            editor.setTool(next);
            if (next === "rect") onRepairChange(true);
          }}
        />
        <section
          className="image-preview-frame"
          aria-label={t.canvas}
          tabIndex={-1}
          data-zoomed={zoomed}
          data-pannable={!repairing || tool === "hand"}
          data-dragging={dragging}
          data-tool={tool}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onLostPointerCapture={endPan}
        >
          <PreviewSourceImage
            assetId={source.id}
            alt={meta.prompt ? displayPrompt(meta.prompt, locale) : t.generatedImage}
            zoom={zoom}
            pan={pan}
          />
          {editor.image && (
            <RepairCanvas
              width={editor.width}
              height={editor.height}
              maxFitScale={Math.min(
                1,
                editor.image.naturalWidth / editor.width,
                editor.image.naturalHeight / editor.height,
              )}
              regions={repairing ? editor.draft.regions : []}
              selected={editor.selected}
              tool={tool}
              zoom={zoom}
              pan={pan}
              interactive={repairing}
              disabled={!repairing || !!editor.locked}
              onSelect={editor.select}
              onChange={editor.change}
            />
          )}
        </section>
        <PreviewZoomBar size={size} zoom={zoom} setZoom={setZoom} fit={fit} />
      </section>
      {repairing ? (
        <LocalRepairPanel
          source={source}
          editor={editor}
          onBack={leaveRepair}
          onPreview={onPreview}
        />
      ) : (
        <ImagePreviewDetails
          source={source}
          meta={meta}
          modelName={modelDisplayName(meta.model, catalog.data?.models ?? [], locale)}
          onRepair={enterRepair}
        />
      )}
      <RepairNoticeRegion />
    </>
  );
}

function PreviewSourceImage({
  assetId,
  alt,
  zoom,
  pan,
}: {
  assetId: string;
  alt: string;
  zoom: number;
  pan: { x: number; y: number };
}) {
  const t = useMessages(componentsMessages);
  const [loading, setLoading] = useState(true);
  const settle = () => setLoading(false);
  return (
    <>
      <AssetImage
        className="image-preview-image"
        assetId={assetId}
        alt={alt}
        draggable={false}
        style={{
          scale: `${zoom / 100}`,
          translate: `${pan.x}px ${pan.y}px`,
          visibility: loading ? "hidden" : undefined,
        }}
        onLoad={settle}
        onUnavailable={settle}
        fallback={
          <p className="image-preview-load-failed" role="status">
            {t.viewerLoadFailed}
          </p>
        }
      />
      {loading && <MediaSkeleton label={t.viewerLoading} />}
    </>
  );
}

function usePreviewPan(
  baseTool: string,
  repairing: boolean,
  wheelZoom: ReturnType<typeof usePreviewZoom>["wheelZoom"],
) {
  const stage = useRef<HTMLElement>(null);
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [space, setSpace] = useState(false);
  const tool = space ? "hand" : baseTool;
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(".preview-canvas-toolbar")) {
        stage.current?.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const area = stage.current;
    if (!area) return;
    const onWheel = (event: WheelEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".preview-canvas-toolbar, .image-preview-bar")
      )
        return;
      event.preventDefault();
      wheelZoom(event.deltaY, event.ctrlKey);
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, [wheelZoom]);
  useEffect(() => {
    const dialog = stage.current?.closest('[role="dialog"]');
    const down = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.code !== "Space" ||
        !(target instanceof HTMLElement) ||
        target.closest('[role="dialog"]') !== dialog ||
        target.closest('button, input, textarea, select, [contenteditable="true"], [role="slider"]')
      )
        return;
      event.preventDefault();
      setSpace(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false);
    };
    const blur = () => {
      setSpace(false);
      dragOrigin.current = null;
      setDragging(false);
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const startPan = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.focus({ preventScroll: true });
    if ((repairing && tool !== "hand") || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };
  const movePan = (event: ReactPointerEvent<HTMLElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const next = {
      x: origin.panX + event.clientX - origin.x,
      y: origin.panY + event.clientY - origin.y,
    };
    setPan(next);
  };
  const endPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragOrigin.current) return;
    dragOrigin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return { stage, tool, pan, setPan, dragging, startPan, movePan, endPan };
}

function PreviewZoomBar({
  size,
  zoom,
  setZoom,
  fit,
}: {
  size: string;
  zoom: number;
  setZoom: ReturnType<typeof usePreviewZoom>["setZoom"];
  fit: () => void;
}) {
  const t = useMessages(imageWorkspaceMessages);
  return (
    <footer className="image-preview-bar">
      <span className="image-preview-bar-size">{size}</span>
      <Button
        size="sm"
        variant="ghost"
        className="preview-fit"
        aria-label={t.fitCanvas}
        onPress={fit}
      >
        {t.fitCanvas}
      </Button>
      <Slider
        className="image-preview-zoom"
        aria-label={t.zoom}
        minValue={previewMinZoom}
        maxValue={500}
        step={5}
        value={zoom}
        onChange={(value) => setZoom(Number(value))}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <output className="image-preview-zoom-value" aria-label={t.zoomLevel}>
        {Math.round(zoom)}%
      </output>
    </footer>
  );
}
