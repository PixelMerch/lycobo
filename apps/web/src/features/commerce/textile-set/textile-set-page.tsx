import { Button, EmptyState, Popover, Tabs } from "@heroui/react";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { lazy, Suspense, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { TextileImageField } from "./textile-image-field";
import { useTextileSetDraft } from "./textile-set-state";
import { textileViews } from "./textile-views";
import { TextileViewsDialog } from "./textile-views-dialog";
import "./textile-set.css";

const LibraryDialog = lazy(() =>
  import("../../assets/library-dialog").then((module) => ({ default: module.LibraryDialog })),
);

export function TextileSetPage() {
  const { mainImage, detailImage, views, ratio, update } = useTextileSetDraft();
  const viewsAnchor = useRef<HTMLDivElement>(null);
  const viewsTrigger = useRef<HTMLButtonElement>(null);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const selectedViews = textileViews.filter((view) => views.includes(view.id));
  return (
    <div className="workspace textile-workspace">
      <div ref={viewsAnchor} className="textile-views-anchor" aria-hidden="true" />
      <section className="composer-panel" aria-label="家纺套图参数">
        <div className="composer-scroll">
          <h1 className="textile-title">家纺套图</h1>
          <TextileImageField
            label="主图"
            required
            description="上传清晰的家纺主图，完整展示床品"
            exampleSrc="/studio/bedroom-thumb.webp"
            value={mainImage}
            onChange={(image) => update({ mainImage: image })}
            number={1}
          />
          <TextileImageField
            label="详情图"
            description="补充面料、花型或床品局部细节"
            exampleSrc="/studio/set-thumb.webp"
            exampleIsDetail
            value={detailImage}
            onChange={(image) => update({ detailImage: image })}
            number={2}
          />
          <section className="parameter-group textile-view-field" aria-label="裂变类型">
            <h2>
              <span aria-hidden="true" className="textile-required">
                *
              </span>
              裂变类型
            </h2>
            <Popover isOpen={viewsOpen} onOpenChange={setViewsOpen}>
              <Button
                ref={viewsTrigger}
                variant="tertiary"
                className="textile-view-trigger"
                aria-label="选择裂变类型"
              >
                {selectedViews.length ? (
                  <span className="textile-selected-views">
                    {selectedViews.map((view) => view.name).join("、")}
                  </span>
                ) : (
                  <>
                    <UiIcon icon={IconPlus} size="action" />
                    <span>选择裂变类型</span>
                  </>
                )}
                {selectedViews.length > 0 && <UiIcon icon={IconChevronRight} size="small" />}
              </Button>
              {viewsOpen && (
                <TextileViewsDialog
                  anchorRef={viewsAnchor}
                  triggerRef={viewsTrigger}
                  selected={views}
                  onConfirm={(value) => update({ views: value })}
                  onClose={() => setViewsOpen(false)}
                />
              )}
            </Popover>
          </section>
          <section className="parameter-group" aria-label="图片比例">
            <div className="ratio-heading">
              <h2>图片比例</h2>
              <span className="muted">{ratio}</span>
            </div>
            <HomeRatioPicker value={ratio} onChange={(value) => update({ ratio: value })} />
          </section>
        </div>
        <div className="generate-area">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="primary-action generation-submit"
            isDisabled
            aria-description="家纺套图生成功能即将上线"
          >
            立即生成
          </Button>
          <p className="textile-service-status">套图生成功能即将上线</p>
        </div>
      </section>
      <section className="results-panel" aria-label="家纺套图内容">
        <Tabs className="workspace-tabs">
          <Tabs.ListContainer>
            <Tabs.List aria-label="家纺套图工作区">
              <Tabs.Tab id="history">历史记录</Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="history">
            <EmptyState className="textile-history-empty">
              <h2>家纺套图将在这里展示</h2>
              <p>上传主图，选择需要的视角，准备你的商品套图</p>
            </EmptyState>
          </Tabs.Panel>
        </Tabs>
      </section>
      <aside className="history-rail" aria-label="家纺套图历史索引">
        <h2 className="history-rail-title">
          <Button
            variant="tertiary"
            className="history-rail-open"
            aria-label="打开素材库"
            onPress={() => setLibraryOpen(true)}
          >
            <span>我的素材</span>
            <UiIcon icon={IconChevronRight} size="small" />
          </Button>
        </h2>
        <div className="history-rail-list">
          <p>暂无套图</p>
        </div>
      </aside>
      {libraryOpen && (
        <Suspense fallback={null}>
          <LibraryDialog onClose={() => setLibraryOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
