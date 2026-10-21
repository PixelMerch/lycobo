import { Button } from "@heroui/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { ModelId } from "./studio-state";

// Navigation families intentionally do not replace the provider's model IDs.
export const chooserModels = [
  {
    id: "gpt-image-2",
    target: "gpt-image-2",
    cover: "image-2",
    description:
      "通用图像生成与编辑模型，结合文字指令和参考图片组织主体、文字与场景，适用于商品展示、创意海报与日常设计。",
  },
  {
    id: "gpt-image-2.5",
    target: "gpt-image-2.5",
    cover: "image-2-5",
    description:
      "GPT-image-2.5 图像创作模型，兼顾画面文字、写实质感与视觉表达，适用于商业摄影、创意海报和专业设计。",
  },
  {
    id: "nano-banana-2.1",
    target: "nano-banana-2.1",
    cover: "banana",
    description:
      "Nano Banana 2.1 图像模型，面向商品、人像与场景等创作方向，探索写实与创意风格的视觉表达。适用于日常创作与视觉设计。",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  target: ModelId | null;
  cover: string;
  description: string;
}>;

type ChooserModel = (typeof chooserModels)[number];

export function ModelChooserCard({
  model,
  index,
  current,
  onChoose,
}: {
  model: ChooserModel;
  index: number;
  current: boolean;
  onChoose: (target: ModelId) => void;
}) {
  const [frame, setFrame] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const paused = hovered || focused;

  useEffect(() => {
    if (paused || reducedMotion) return;
    // Stagger cards and leave hidden tabs still; no paid generation is involved.
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") setFrame((value) => (value + 1) % 3);
      },
      4200 + index * 600,
    );
    return () => window.clearInterval(timer);
  }, [index, paused, reducedMotion]);

  return (
    <Button
      className="model-card"
      variant="tertiary"
      aria-label={`进入 ${model.id} 创作`}
      aria-current={current ? "true" : "false"}
      onHoverChange={setHovered}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => {
        if (model.target) onChoose(model.target);
      }}
    >
      <span className="model-card-cover" aria-hidden="true">
        <span className="model-card-zoom">
          {[0, 1, 2].map((slide) => (
            <img
              key={slide}
              src={`/studio/models/${model.cover}-${slide + 1}.webp`}
              alt=""
              width="480"
              height="360"
              className={frame === slide ? "is-visible" : undefined}
              decoding="async"
              draggable={false}
            />
          ))}
        </span>
      </span>
      <span className="model-card-body">
        <span className="model-card-title">{model.id}</span>
        <span className="model-card-description">{model.description}</span>
      </span>
    </Button>
  );
}
