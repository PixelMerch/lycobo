import { Button } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { defaultDraft, useStudioStore } from "../generation/studio-state";
import { HomeComposer } from "./home-composer";
import { homeDotGrid } from "./home-dot-grid-config";
import { HomeInspirationGallery } from "./home-inspiration-gallery";
import "../../styles/home.css";

const DotGrid = lazy(() => import("./dot-grid/dot-grid"));

const shortcuts = [
  {
    name: "商品主图",
    image: "/studio/models/image-2-1.webp",
    description: "让商品成为焦点",
    prompt: "保留参考商品的外观和细节，生成一张干净的电商商品主图。",
  },
  {
    name: "场景图",
    image: "/studio/bedroom-thumb.webp",
    description: "为商品搭个场景",
    prompt: "保留参考商品的外观和细节，为商品搭配真实自然的使用场景。",
  },
  {
    name: "创意海报",
    image: "/studio/models/image-2-5-3.webp",
    description: "给画面一点新意",
    prompt: "保留参考商品的外观和细节，创作一张突出商品的商业海报。",
  },
  {
    name: "自由创作",
    image: "/studio/models/banana-1.webp",
    description: "从一个想法开始",
    prompt: "",
  },
];

export function HomePage() {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model] ?? defaultDraft);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const navigate = useNavigate();
  function start(prompt?: string) {
    // The homepage edits the same draft. Entering the workspace never submits paid work.
    if (prompt && !draft.prompt.trim()) updateDraft(model, { prompt });
    navigate("/create");
  }
  return (
    <section className="commerce-home page-panel">
      <div className="home-dot-background" aria-hidden="true" inert>
        <Suspense fallback={null}>
          <DotGrid {...homeDotGrid} />
        </Suspense>
      </div>
      <section className="home-start" aria-labelledby="home-title">
        <h1 id="home-title" className="sr-only">
          为你的商品，创作下一张好图
        </h1>
        <HomeComposer />
        <section className="home-shortcuts" aria-label="创作用途">
          {shortcuts.map((item) => (
            <Button
              variant="ghost"
              size="lg"
              key={item.name}
              aria-label={item.name}
              onPress={() => start(item.prompt)}
            >
              <img src={item.image} alt="" width="64" height="64" decoding="async" />
              <span className="home-shortcut-copy">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <UiIcon icon={IconArrowUpRight} size="small" />
            </Button>
          ))}
        </section>
      </section>
      <HomeInspirationGallery />
    </section>
  );
}
