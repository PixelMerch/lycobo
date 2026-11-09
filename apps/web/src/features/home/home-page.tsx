import { Tabs } from "@heroui/react";
import { useRef } from "react";
import { useSearchParams } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { SelectionHighlight } from "../generation/composer/selection-highlight";
import { shareProductReference } from "../workspace/workspace-state";
import { toolIcons } from "../workspace/workspace-tool-symbol";
import { HomeBackdrop } from "./home-backdrop";
import { HomeComposer } from "./home-composer";
import { HomeDock } from "./home-dock";
import { HomeFooter } from "./home-footer";
import { HomeInspirationGallery } from "./home-inspiration-gallery";
import { homeModeFor, homeModes } from "./home-modes";
import { HomeTemplates } from "./home-templates";
import type { SilkHandle } from "./silk/silk-background";
import "../../styles/home/home.css";

/** 组合首页标语、创作模式、创作框、模板与灵感列表；切换模式保留各工具草稿。 */
export function HomePage() {
  const [search, setSearch] = useSearchParams();
  const mode = homeModeFor(search.get("mode"));
  const backdrop = useRef<SilkHandle>(null);
  const start = useRef<HTMLElement>(null);
  // 切换页签时，丝绸从被选中的页签处荡开一圈涟漪（鼠标与键盘切换都一样）。
  function rippleFromTab(id: string) {
    const index = homeModes.findIndex((item) => item.id === id);
    const tab = start.current?.querySelectorAll<HTMLElement>('.home-modes [role="tab"]')[index];
    if (!tab) return;
    const rect = tab.getBoundingClientRect();
    backdrop.current?.pulseAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
  function selectMode(id: string) {
    const next = homeModes.find((item) => item.id === id);
    if (!next || next.id === mode.id) return;
    // 与工具坞一致：只向目标工具的空图片槽带入商品图，不覆盖已有草稿。
    shareProductReference(mode.path, next.path);
    const params = new URLSearchParams(search);
    if (next.id === "create") params.delete("mode");
    else params.set("mode", next.id);
    setSearch(params, { replace: true, preventScrollReset: true });
    rippleFromTab(next.id);
  }
  return (
    <section className="commerce-home page-panel" data-mode={mode.id}>
      <HomeBackdrop modeId={mode.id} ref={backdrop} />
      <section ref={start} className="home-start" aria-labelledby="home-title">
        <h1 id="home-title" className="home-slogan">
          {mode.slogan.map((part) => (
            <SloganPart key={part} text={part} highlight={mode.sloganHighlight} />
          ))}
        </h1>
        <Tabs
          className="home-modes"
          selectedKey={mode.id}
          onSelectionChange={(key) => selectMode(String(key))}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="创作模式">
              {homeModes.map((item) => (
                <Tabs.Tab id={item.id} key={item.id}>
                  {item.id === mode.id && (
                    <>
                      <SelectionHighlight
                        layoutId="home-mode-selection"
                        layoutDependency={mode.id}
                      />
                      <UiIcon
                        icon={toolIcons[item.id]}
                        size="navigation"
                        className="home-mode-icon"
                      />
                    </>
                  )}
                  {item.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id={mode.id} className="home-stage">
            <HomeComposer mode={mode} />
            <HomeTemplates mode={mode} />
          </Tabs.Panel>
        </Tabs>
      </section>
      <HomeInspirationGallery />
      <HomeFooter />
      <HomeDock />
    </section>
  );
}

/** 标语的一段；含关键词时，关键词用当前模式的强调渐变显示（Lycobo 自己的标语样式）。 */
function SloganPart({ text, highlight }: { text: string; highlight: string }) {
  const index = text.indexOf(highlight);
  if (index < 0) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, index)}
      <em className="home-slogan-highlight">{highlight}</em>
      {text.slice(index + highlight.length)}
    </span>
  );
}
