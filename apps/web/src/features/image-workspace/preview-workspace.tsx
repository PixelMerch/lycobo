import { Button, Slider } from "@heroui/react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { AssetImage } from "../generation/asset-image";
import type { PreviewImage, PreviewMeta } from "./image-preview";
import { ImagePreviewDetails } from "./image-preview-details";
import { LocalRepairPanel } from "./local-edit/local-repair";
import { RepairCanvas } from "./local-edit/repair-canvas";
import { RepairNoticeRegion, useRepairNotice } from "./local-edit/repair-notice";
import { useLocalRepair } from "./local-edit/use-local-repair";
import { PreviewCanvasToolbar } from "./preview-canvas-toolbar";
import { PreviewDotGrid } from "./preview-dot-grid";
import { usePreviewZoom } from "./use-preview-zoom";
import "./preview-workspace.css";

function panLimits(frame: HTMLElement | null, picture: HTMLElement | null, scale: number) {
  if (!frame || !picture) return { x: 0, y: 0 };
  return {
    x: Math.max(0, (picture.offsetWidth * scale - frame.clientWidth) / 2),
    y: Math.max(0, (picture.offsetHeight * scale - frame.clientHeight) / 2),
  };
}
function clampPan(pan: { x: number; y: number }, limits: { x: number; y: number }) {
  return {
    x: Math.min(limits.x, Math.max(-limits.x, pan.x)),
    y: Math.min(limits.y, Math.max(-limits.y, pan.y)),
  };
}

/** One persistent image, viewport and tool dock; only its property panel changes. */
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
  const editor = useLocalRepair(source, meta, repairing ? "rect" : "select");
  const { zoom, setZoom, wheelZoom } = usePreviewZoom();
  /* Task progress is announced in the bottom-right notice instead of the form,
   * so the editor keeps only inputs and the submit action. */
  useRepairNotice({
    jobId: editor.draft.jobId,
    status: editor.job.data?.status,
    succeeded: !!editor.result,
  });
  const stage = useRef<HTMLElement>(null);
  const frame = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const dragOrigin = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [space, setSpace] = useState(false);
  const tool = space ? "hand" : editor.tool;
  const zoomed = zoom > 100;
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
    const limits = panLimits(frame.current, picture.current, zoom / 100);
    setPan((current) => {
      const next = clampPan(current, limits);
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [zoom]);
  useEffect(() => {
    const area = stage.current;
    if (!area) return;
    const onWheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest(".preview-canvas-toolbar"))
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
    if ((repairing && tool !== "hand") || (!zoomed && tool !== "hand") || event.button !== 0)
      return;
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
    setPan(
      tool === "hand"
        ? next
        : clampPan(next, panLimits(frame.current, picture.current, zoom / 100)),
    );
  };
  const endPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragOrigin.current) return;
    dragOrigin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
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
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };
  const size = source.width && source.height ? `${source.width} x ${source.height}` : "尺寸待同步";
  return (
    <>
      <section
        className="image-preview-stage preview-canvas-stage preview-dot-surface"
        aria-label="图片预览"
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
          aria-label="图片画布"
          tabIndex={-1}
          ref={frame}
          data-zoomed={zoomed}
          data-dragging={dragging}
          data-tool={tool}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onLostPointerCapture={endPan}
        >
          <AssetImage
            ref={picture}
            className="image-preview-image"
            assetId={source.id}
            alt={meta.prompt || "生成图片"}
            draggable={false}
            style={{ scale: `${zoom / 100}`, translate: `${pan.x}px ${pan.y}px` }}
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
      </section>
      {repairing ? (
        <LocalRepairPanel
          source={source}
          editor={editor}
          onBack={leaveRepair}
          onPreview={onPreview}
        />
      ) : (
        <ImagePreviewDetails source={source} meta={meta} onRepair={enterRepair} />
      )}
      <footer className="image-preview-bar preview-dot-surface" ref={footer}>
        <PreviewDotGrid stage={footer} />
        <span className="image-preview-bar-size">{size}</span>
        <Button
          size="sm"
          variant="ghost"
          className="preview-fit"
          aria-label="适应画布"
          onPress={fit}
        >
          适应画布
        </Button>
        <Slider
          className="image-preview-zoom"
          aria-label="缩放"
          minValue={100}
          maxValue={500}
          step={10}
          value={zoom}
          onChange={(value) => setZoom(Number(value))}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <output className="image-preview-zoom-value" aria-label="画布缩放比例">
          {Math.round(zoom)}%
        </output>
      </footer>
      <RepairNoticeRegion />
    </>
  );
}
