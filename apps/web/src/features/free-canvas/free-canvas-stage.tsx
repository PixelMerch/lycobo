import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import type { FreeCanvasItem, FreeCanvasTool } from "./free-canvas-state";

/** 把图片地址加载成 Konva 可用对象；加载失败时返回 null。 */
function useCanvasImage(src: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    let active = true;
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => {
      if (active) setImage(element);
    };
    element.onerror = () => {
      if (active) setImage(null);
    };
    element.src = src;
    return () => {
      active = false;
      element.onload = null;
      element.onerror = null;
    };
  }, [src]);
  return image;
}

type Point = { x: number; y: number };
type NodePatch = { x: number; y: number; width: number; height: number; rotation: number };

function ImageNode({
  item,
  selected,
  onSelect,
  onChange,
}: {
  item: FreeCanvasItem;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: NodePatch) => void;
}) {
  const image = useCanvasImage(item.src);
  if (!image)
    return (
      <Rect
        id={`node-${item.id}`}
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rotation={item.rotation}
        fill="#E9E6DC"
        stroke={selected ? "#6F7D52" : "#D6D2C4"}
        strokeWidth={selected ? 2 : 1}
        onClick={onSelect}
        onTap={onSelect}
        draggable
        onDragEnd={(event) => onChange({ ...item, x: event.target.x(), y: event.target.y() })}
      />
    );
  return (
    <KonvaImage
      id={`node-${item.id}`}
      image={image}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      rotation={item.rotation}
      onClick={onSelect}
      onTap={onSelect}
      draggable
      onDragEnd={(event) => onChange({ ...item, x: event.target.x(), y: event.target.y() })}
    />
  );
}

function TextNode({
  item,
  onSelect,
  onChange,
}: {
  item: FreeCanvasItem;
  onSelect: () => void;
  onChange: (patch: NodePatch) => void;
}) {
  const note = item.kind === "note";
  return (
    <>
      {note && (
        <Rect
          x={item.x}
          y={item.y}
          width={item.width}
          height={item.height}
          rotation={item.rotation}
          fill={item.fill ?? "#FFF6C9"}
          cornerRadius={8}
          shadowColor="#00000018"
          shadowBlur={10}
          shadowOffsetY={4}
          listening={false}
        />
      )}
      <Text
        id={`node-${item.id}`}
        text={item.text ?? ""}
        x={item.x}
        y={item.y}
        width={item.width}
        {...(note ? { height: item.height, padding: 16 } : { padding: 0 })}
        rotation={item.rotation}
        fontSize={item.fontSize ?? (note ? 15 : 28)}
        lineHeight={1.45}
        fontStyle={note ? "normal" : "bold"}
        fill="#242820"
        wrap="word"
        onClick={onSelect}
        onTap={onSelect}
        draggable
        onDragEnd={(event) => onChange({ ...item, x: event.target.x(), y: event.target.y() })}
      />
    </>
  );
}

/** 把变换框绑定到当前选中的节点；节点增删后重新绑定。 */
function syncTransformer(
  layer: Konva.Group | null,
  transformer: Konva.Transformer | null,
  selectedId: string | null,
  selectionKey: string,
) {
  if (!transformer) return;
  const node = selectedId ? layer?.findOne(`#node-${selectedId}`) : null;
  transformer.nodes(node ? [node] : []);
  if (selectionKey) transformer.getLayer()?.batchDraw();
}

/** 画布手势：滚轮缩放围绕指针，手形工具或 Alt 拖动平移。 */
function useStageGestures({
  tool,
  zoom,
  pan,
  onPan,
  onZoom,
  onSelect,
  panning,
}: {
  tool: FreeCanvasTool;
  zoom: number;
  pan: Point;
  onPan: (pan: Point) => void;
  onZoom: (zoom: number) => void;
  onSelect: (id: string | null) => void;
  panning: React.RefObject<{ start: Point; origin: Point } | null>;
}) {
  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const next = Math.min(4, Math.max(0.25, zoom * (event.evt.deltaY > 0 ? 0.94 : 1.06)));
    const world = { x: (pointer.x - pan.x) / zoom, y: (pointer.y - pan.y) / zoom };
    onPan({ x: pointer.x - world.x * next, y: pointer.y - world.y * next });
    onZoom(next);
  };

  const startPointer = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const background = event.target === stage || event.target.name() === "canvas-background";
    const shouldPan = tool === "hand" || (background && event.evt.altKey);
    if (background && !shouldPan) onSelect(null);
    if (shouldPan) panning.current = { start: pointer, origin: pan };
  };

  const movePointer = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const current = panning.current;
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!current || !pointer) return;
    onPan({
      x: current.origin.x + pointer.x - current.start.x,
      y: current.origin.y + pointer.y - current.start.y,
    });
  };

  const endPointer = () => {
    panning.current = null;
  };

  return { handleWheel, startPointer, movePointer, endPointer };
}

/** 自由画布舞台：缩放、平移、选择、拖动与变换节点。 */
export function FreeCanvasStage({
  items,
  selectedId,
  tool,
  zoom,
  pan,
  onSelect,
  onPan,
  onZoom,
  onChange,
}: {
  items: FreeCanvasItem[];
  selectedId: string | null;
  tool: FreeCanvasTool;
  zoom: number;
  pan: Point;
  onSelect: (id: string | null) => void;
  onPan: (pan: Point) => void;
  onZoom: (zoom: number) => void;
  onChange: (id: string, patch: NodePatch) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const content = useRef<Konva.Group>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const panning = useRef<{ start: Point; origin: Point } | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 选中节点或节点数量变化时，把变换框绑定到该节点。
  const selectionKey = `${selectedId ?? "none"}:${items.length}`;
  useEffect(() => {
    syncTransformer(content.current, transformer.current, selectedId, selectionKey);
  }, [selectedId, selectionKey]);

  const gestures = useStageGestures({ tool, zoom, pan, onPan, onZoom, onSelect, panning });
  const { handleWheel, startPointer, movePointer, endPointer } = gestures;

  return (
    <div className="free-canvas-stage" ref={container}>
      <Stage
        width={viewport.width}
        height={viewport.height}
        onWheel={handleWheel}
        onPointerDown={startPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <Layer>
          <Rect
            name="canvas-background"
            x={-4000}
            y={-4000}
            width={8000}
            height={8000}
            fill="#F7F5F0"
            onClick={() => onSelect(null)}
            onTap={() => onSelect(null)}
          />
          <Group ref={content} x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
            {items.map((item) =>
              item.kind === "image" ? (
                <ImageNode
                  item={item}
                  key={item.id}
                  selected={item.id === selectedId}
                  onSelect={() => tool !== "hand" && onSelect(item.id)}
                  onChange={(patch) => onChange(item.id, patch)}
                />
              ) : (
                <TextNode
                  item={item}
                  key={item.id}
                  onSelect={() => tool !== "hand" && onSelect(item.id)}
                  onChange={(patch) => onChange(item.id, patch)}
                />
              ),
            )}
            <Transformer
              ref={transformer}
              rotateEnabled
              flipEnabled={false}
              anchorSize={9}
              anchorCornerRadius={4}
              anchorFill="#FFFFFF"
              anchorStroke="#6F7D52"
              borderStroke="#6F7D52"
              boundBoxFunc={(old, next) => (next.width < 24 || next.height < 24 ? old : next)}
              onTransformEnd={() => {
                if (!selectedId) return;
                const node = content.current?.findOne(`#node-${selectedId}`);
                if (!node) return;
                const width = Math.max(24, node.width() * node.scaleX());
                const height = Math.max(24, node.height() * node.scaleY());
                node.scale({ x: 1, y: 1 });
                onChange(selectedId, {
                  x: node.x(),
                  y: node.y(),
                  width,
                  height,
                  rotation: node.rotation(),
                });
              }}
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
