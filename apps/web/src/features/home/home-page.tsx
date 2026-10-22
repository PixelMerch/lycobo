import { Button, Modal } from "@heroui/react";
import { IconBox, IconPhoto, IconSparkles, IconTextCaption } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { useStudioStore } from "../generation/studio-state";
import { HomeComposer } from "./home-composer";
import "../../styles/home.css";

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
  const [guide, setGuide] = useState<string | null>(null);
  function start(prompt?: string) {
    // The homepage edits the same draft. Entering the workspace never submits paid work.
    if (prompt && !draft.prompt.trim()) updateDraft(model, { prompt });
    navigate("/create");
  }
  return (
    <section className="commerce-home page-panel">
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
      <footer className="home-guides">
        <Button size="sm" variant="ghost" onPress={() => setGuide("参考图上传指南")}>
          参考图上传指南
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setGuide("如何保持商品一致性")}>
          如何保持商品一致性
        </Button>
      </footer>
      <Modal
        isOpen={guide !== null}
        onOpenChange={(open) => {
          if (!open) setGuide(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{guide}</Modal.Heading>
                <Modal.CloseTrigger aria-label="关闭指南" />
              </Modal.Header>
              <Modal.Body>
                <p>
                  {guide === "参考图上传指南"
                    ? "支持 PNG、JPEG 和 WebP，单张不超过 10MB，最多添加 5 张。优先上传清晰、无遮挡的商品图。参考图会在你确认生成时上传。"
                    : "使用清晰的商品正面图，在提示词中明确需要保留的形状、颜色、标签和材质。先检查生成结果，再用于商品展示；复杂文字与细节需要逐项核对。"}
                </p>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
