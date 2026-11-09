import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Circle, Group, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { useMessages } from "../../../i18n/messages";
import { imageWorkspaceMessages } from "../image-workspace-messages";
import { constrainRegion, type RepairRegion } from "./local-repair-state";

type Point = { x: number; y: number };
type Props = {
  width: number;
  height: number;
  regions: RepairRegion[];
  selected: string | null;
  tool: string;
  zoom: number;
  disabled: boolean;
  onSelect: (id: string) => void;
  onChange: (regions: RepairRegion[]) => void;
  pan: Point;
  interactive: boolean;
  maxFitScale?: number;
};
const accent = "#A8FF00";

function Region({
  region,
  number,
  selected,
  scale,
  disabled,
  bounds,
  onSelect,
  onChange,
}: {
  region: RepairRegion;
  number: number;
  selected: boolean;
  scale: number;
  disabled: boolean;
  bounds: { width: number; height: number };
  onSelect: () => void;
  onChange: (region: RepairRegion) => void;
}) {
  const badge = useRef<Konva.Group>(null);
  const rect = useRef<Konva.Rect>(null);
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (selected && !disabled && rect.current) transformer.current?.nodes([rect.current]);
  }, [selected, disabled]);
  return (
    <>
      <Rect
        ref={rect}
        name="repair-region"
        x={region.x}
        y={region.y}
        width={region.width}
        height={region.height}
        stroke={accent}
        strokeWidth={selected ? 2 : 1}
        strokeScaleEnabled={false}
        fill={selected ? "#A8FF0012" : "#A8FF0006"}
        draggable={!disabled}
        onClick={onSelect}
        onTap={onSelect}
        onDragStart={onSelect}
        onDragMove={(event) => {
          const node = event.target;
          const next = constrainRegion(
            { ...region, x: node.x(), y: node.y() },
            bounds.width,
            bounds.height,
          );
          node.position({ x: next.x, y: next.y });
          badge.current?.position({ x: next.x, y: next.y });
        }}
        onTransform={() => {
          const node = rect.current;
          if (node) badge.current?.position({ x: node.x(), y: node.y() });
        }}
        onDragEnd={(event) => onChange({ ...region, x: event.target.x(), y: event.target.y() })}
        onTransformEnd={() => {
          const node = rect.current;
          if (!node) return;
          const next = {
            ...region,
            x: node.x(),
            y: node.y(),
            width: node.width() * node.scaleX(),
            height: node.height() * node.scaleY(),
          };
          node.scale({ x: 1, y: 1 });
          onChange(next);
        }}
      />
      {selected && !disabled && (
        <Transformer
          ref={transformer}
          rotateEnabled={false}
          flipEnabled={false}
          keepRatio={false}
          ignoreStroke
          borderStroke={accent}
          anchorStroke={accent}
          anchorFill="#FFFFFF"
          anchorSize={9}
          anchorCornerRadius={4}
          boundBoxFunc={(old, next) => {
            const transform = rect.current?.getParent()?.getAbsoluteTransform();
            if (!transform || next.width < 12 || next.height < 12) return old;
            const start = transform.point({ x: 0, y: 0 });
            const end = transform.point({ x: bounds.width, y: bounds.height });
            return next.x < start.x - 0.5 ||
              next.y < start.y - 0.5 ||
              next.x + next.width > end.x + 0.5 ||
              next.y + next.height > end.y + 0.5
              ? old
              : next;
          }}
        />
      )}
      <Group
        ref={badge}
        x={region.x}
        y={region.y}
        scaleX={1 / scale}
        scaleY={1 / scale}
        listening={false}
      >
        {/* Neutral dark chip: the number stays legible over both light and dark
         * photos without adding a second brand accent to the canvas. */}
        <Circle radius={12} fill="#17171be6" stroke="#ffffff4d" strokeWidth={1} />
        <Text
          text={String(number)}
          x={-12}
          y={-7}
          width={24}
          align="center"
          fontSize={14}
          fill="#FFFFFF"
        />
      </Group>
    </>
  );
}

/** 局部编辑画布：显示原图并绘制、选择和拖动修改区域。 */
export function RepairCanvas(props: Props) {
  const t = useMessages(imageWorkspaceMessages);
  const { width, height, regions, selected, tool, disabled, onSelect, onChange, interactive } =
    props;
  const hand = tool === "hand";
  const { container, group, viewport, drawing, safeScale, offset, start, move, finish, cancel } =
    useRepairCanvasGestures(props);
  return (
    <section
      className="repair-canvas"
      ref={container}
      data-tool={hand ? "hand" : tool}
      data-interactive={interactive && !hand ? "true" : "false"}
      aria-label={t.editCanvas}
    >
      <Stage
        width={viewport.width}
        height={viewport.height}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerLeave={finish}
        onPointerCancel={cancel}
      >
        <Layer>
          <Group ref={group} x={offset.x} y={offset.y} scaleX={safeScale} scaleY={safeScale}>
            {regions.map((region, index) => (
              <Region
                key={region.id}
                region={region}
                number={index + 1}
                bounds={{ width, height }}
                selected={region.id === selected}
                scale={safeScale}
                disabled={disabled || hand}
                onSelect={() => onSelect(region.id)}
                onChange={(next) =>
                  onChange(
                    regions.map((value) =>
                      value.id === next.id ? constrainRegion(next, width, height) : value,
                    ),
                  )
                }
              />
            ))}
            {drawing && (
              <Rect
                {...drawing}
                stroke={accent}
                strokeWidth={1}
                strokeScaleEnabled={false}
                listening={false}
              />
            )}
          </Group>
        </Layer>
      </Stage>
    </section>
  );
}

function useRepairCanvasGestures(props: Props) {
  const { width, height, regions, tool, zoom, disabled, onSelect, onChange, pan, interactive } =
    props;
  const container = useRef<HTMLDivElement>(null);
  const group = useRef<Konva.Group>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [drawing, setDrawing] = useState<RepairRegion | null>(null);
  const gesture = useRef<{ start: Point; drawing: boolean } | null>(null);
  const scale =
    (Math.min(viewport.width / width, viewport.height / height, props.maxFitScale ?? 1) * zoom) /
    100;
  const safeScale = Math.max(0.001, scale);
  const offset = {
    x: (viewport.width - width * safeScale) / 2 + pan.x,
    y: (viewport.height - height * safeScale) / 2 + pan.y,
  };
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const cancel = () => {
      gesture.current = null;
      setDrawing(null);
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);
  useEffect(() => {
    if (!interactive || disabled || tool !== "rect") {
      gesture.current = null;
      setDrawing(null);
    }
  }, [interactive, disabled, tool]);
  const point = () => {
    const position = group.current?.getRelativePointerPosition();
    return position
      ? {
          x: Math.max(0, Math.min(width, position.x)),
          y: Math.max(0, Math.min(height, position.y)),
        }
      : null;
  };
  const finish = () => {
    if (
      !disabled &&
      interactive &&
      gesture.current?.drawing &&
      drawing &&
      drawing.width * safeScale >= 12 &&
      drawing.height * safeScale >= 12
    ) {
      onChange([...regions, drawing]);
      onSelect(drawing.id);
    }
    gesture.current = null;
    setDrawing(null);
  };
  const start = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer || event.evt.button > 0) return;
    if (
      disabled ||
      tool !== "rect" ||
      regions.length >= 8 ||
      (event.target !== stage && event.target.name() !== "repair-base")
    )
      return;
    const start = point();
    const local = group.current?.getRelativePointerPosition();
    if (!start || !local || local.x < 0 || local.x > width || local.y < 0 || local.y > height)
      return;
    gesture.current = { start, drawing: true };
    setDrawing({ id: crypto.randomUUID(), ...start, width: 0, height: 0, prompt: "" });
  };
  const move = () => {
    const current = gesture.current;
    if (!current) return;
    const end = point();
    if (end)
      setDrawing(
        (value) =>
          value && {
            ...value,
            x: Math.min(current.start.x, end.x),
            y: Math.min(current.start.y, end.y),
            width: Math.abs(end.x - current.start.x),
            height: Math.abs(end.y - current.start.y),
          },
      );
  };
  const cancel = () => {
    gesture.current = null;
    setDrawing(null);
  };
  return { container, group, viewport, drawing, safeScale, offset, start, move, finish, cancel };
}
