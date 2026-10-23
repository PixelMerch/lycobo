import { Button } from "@heroui/react";
import { IconBox, IconPhoto, IconSparkles, IconTextCaption } from "@tabler/icons-react";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { useStudioStore } from "../generation/studio-state";
import { HomeComposer } from "./home-composer";
import { homeDotGrid } from "./home-dot-grid-config";
import "../../styles/home.css";

const DotGrid = lazy(() => import("./dot-grid/dot-grid"));

const shortcuts = [
  {
    name: "商品主图",
    icon: IconPhoto,
    prompt: "保留参考商品的外观和细节，生成一张干净的电商商品主图。",
  },
  {
    name: "场景图",
    icon: IconBox,
    prompt: "保留参考商品的外观和细节，为商品搭配真实自然的使用场景。",
  },
  {
    name: "创意海报",
    icon: IconTextCaption,
    prompt: "保留参考商品的外观和细节，创作一张突出商品的商业海报。",
  },
  { name: "自由创作", icon: IconSparkles, prompt: "" },
];

export function HomePage() {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model]);
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
            <Button variant="ghost" key={item.name} onPress={() => start(item.prompt)}>
              <UiIcon icon={item.icon} size="action" />
              {item.name}
            </Button>
          ))}
        </section>
      </section>
    </section>
  );
}
