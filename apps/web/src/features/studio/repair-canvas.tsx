import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Image as CanvasImage,
  Circle,
  Group,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { constrainRegion, type RepairRegion } from "./local-repair-state";

type Point = { x: number; y: number };
type Props = {
  image: HTMLImageElement;
  width: number;
  height: number;
  regions: RepairRegion[];
  selected: string | null;
  tool: string;
  zoom: number;
  disabled: boolean;
  onSelect: (id: string) => void;
  onChange: (regions: RepairRegion[]) => void;
  onZoom: (zoom: number) => void;
};
const accent = "#BAA4FF";

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
        fill={selected ? "#BAA4FF12" : "#BAA4FF06"}
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
        <Circle radius={12} fill={accent} />
        <Text
          text={String(number)}
          x={-12}
          y={-7}
          width={24}
          align="center"
          fontSize={14}
          fill="#09070D"
        />
      </Group>
    </>
  );
}

export function RepairCanvas(props: Props) {
  const {
    image,
    width,
    height,
    regions,
    selected,
    tool,
    zoom,
    disabled,
    onSelect,
    onChange,
    onZoom,
  } = props;
  const container = useRef<HTMLDivElement>(null);
  const group = useRef<Konva.Group>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [space, setSpace] = useState(false);
  const [drawing, setDrawing] = useState<RepairRegion | null>(null);
  const gesture = useRef<{ start: Point; pan: Point; drawing: boolean } | null>(null);
  const hand = tool === "hand" || space;
  const scale =
    (Math.min((viewport.width - 40) / width, (viewport.height - 40) / height) * zoom) / 100;
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
    const down = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.isContentEditable)
      )
        return;
      // Space on a button must continue to activate it.
      if (event.target instanceof HTMLElement && event.target.closest("button")) return;
      event.preventDefault();
      setSpace(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false);
    };
    const blur = () => {
      setSpace(false);
      gesture.current = null;
      setDrawing(null);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
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
  return (
    <section
      className="repair-canvas"
      ref={container}
      data-tool={hand ? "hand" : tool}
      aria-label="局部修复画布"
    >
      <Stage
        width={viewport.width}
        height={viewport.height}
        onWheel={(event) => {
          event.evt.preventDefault();
          const next = Math.min(500, Math.max(25, zoom + (event.evt.deltaY < 0 ? 10 : -10)));
          const pointer = event.target.getStage()?.getPointerPosition();
          if (pointer) {
            const factor = next / zoom;
            setPan({
              x: (pointer.x - viewport.width / 2) * (1 - factor) + pan.x * factor,
              y: (pointer.y - viewport.height / 2) * (1 - factor) + pan.y * factor,
            });
          }
          onZoom(next);
        }}
        onPointerDown={(event) => {
          const stage = event.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (!pointer || event.evt.button > 0) return;
          if (hand) {
            gesture.current = { start: pointer, pan, drawing: false };
            return;
          }
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
          gesture.current = { start, pan, drawing: true };
          setDrawing({ id: crypto.randomUUID(), ...start, width: 0, height: 0, prompt: "" });
        }}
        onPointerMove={(event) => {
          const current = gesture.current;
          if (!current) return;
          if (!current.drawing) {
            const pointer = event.target.getStage()?.getPointerPosition();
            if (pointer)
              setPan({
                x: current.pan.x + pointer.x - current.start.x,
                y: current.pan.y + pointer.y - current.start.y,
              });
          } else {
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
          }
        }}
        onPointerUp={finish}
        onPointerLeave={finish}
        onPointerCancel={() => {
          gesture.current = null;
          setDrawing(null);
        }}
      >
        <Layer>
          <Group ref={group} x={offset.x} y={offset.y} scaleX={safeScale} scaleY={safeScale}>
            <CanvasImage name="repair-base" image={image} width={width} height={height} />
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
