import { Button, Tabs } from "@heroui/react";
import {
  IconCamera,
  IconLayoutCollage,
  IconPhoto,
  IconSparkles,
  type TablerIcon,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { SelectionHighlight } from "../generation/composer/selection-highlight";
import {
  type HomeInspiration,
  type InspirationCategory,
  inspirationCategories,
} from "./home-inspiration-data";
import { homeInspirationMessages } from "./home-inspiration-messages";
import { distributeColumns, useColumnCount } from "./inspiration-columns";
import { inspirationLibraryPath } from "./inspiration-path";
import { useInspirationPaging } from "./use-inspiration-paging";

// 卡片左下角的分类标签图标，与工作区工具图标保持同一风格。
const categoryIcons = {
  product: IconCamera,
  scene: IconPhoto,
  textile: IconLayoutCollage,
  creative: IconSparkles,
} satisfies Record<HomeInspiration["category"], TablerIcon>;

/**
 * 作品墙：分类页签加瀑布流。首页先显示一部分、滚到底部再补两次，之后出现“查看更多案例”进入案例库；
 * 案例库（library）一次显示全部，不再分批。
 */
export function InspirationWall({
  items,
  library,
  onOpen,
  onUse,
}: {
  items: HomeInspiration[];
  library: boolean;
  onOpen: (item: HomeInspiration) => void;
  onUse: (item: HomeInspiration) => void;
}) {
  const t = useMessages(homeInspirationMessages);
  const navigate = useNavigate();
  const [category, setCategory] = useState<InspirationCategory>("all");
  const visible = items.filter((item) => category === "all" || item.category === category);
  const paging = useInspirationPaging(visible.length, category);
  const shown = library ? visible : visible.slice(0, paging.count);
  const columns = distributeColumns(shown, useColumnCount());
  return (
    <Tabs
      selectedKey={category}
      onSelectionChange={(key) => {
        const next = inspirationCategories.find((entry) => entry === key);
        if (next) setCategory(next);
      }}
    >
      <div className="home-inspiration-bar">
        <Tabs.ListContainer>
          <Tabs.List aria-label={t.categoryList}>
            {inspirationCategories.map((id) => (
              <Tabs.Tab id={id} key={id}>
                {id === category && (
                  <SelectionHighlight
                    layoutId="home-inspiration-selection"
                    layoutDependency={category}
                  />
                )}
                {t.categories[id]}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </div>
      <Tabs.Panel id={category}>
        <div className="home-inspiration-grid">
          {columns.map((column) => (
            <div className="home-inspiration-column" key={column.id}>
              {column.items.map((item, position) => (
                <InspirationTile
                  key={item.id}
                  item={item}
                  order={position}
                  onOpen={() => onOpen(item)}
                  onUse={() => onUse(item)}
                />
              ))}
            </div>
          ))}
        </div>
        {!library && !paging.finished && (
          <div ref={paging.sentinelRef} className="home-inspiration-sentinel" aria-hidden="true" />
        )}
        {!library && paging.finished && (
          <div className="home-inspiration-more">
            <Button variant="secondary" onPress={() => void navigate(inspirationLibraryPath)}>
              {t.more}
            </Button>
          </div>
        )}
      </Tabs.Panel>
    </Tabs>
  );
}

/** 点图片打开详情；“做同款”是并列按钮，不嵌套在图片按钮里。 */
function InspirationTile({
  item,
  order,
  onOpen,
  onUse,
}: {
  item: HomeInspiration;
  order: number;
  onOpen: () => void;
  onUse: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const t = useMessages(homeInspirationMessages);
  return (
    <motion.div
      className="home-inspiration-tile"
      data-shape={item.shape}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: 0.5,
        delay: Math.min(order, 6) * 0.05,
        ease: [0.215, 0.61, 0.355, 1],
      }}
    >
      {/* 光晕：示例图自己的颜色在卡片四周晕开，只作装饰。 */}
      <img
        className="home-inspiration-glow"
        src={item.image}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <Button
        variant="tertiary"
        className="home-inspiration-card"
        aria-label={t.view(item.title)}
        onPress={onOpen}
      >
        <img
          src={item.image}
          alt={item.title}
          width="480"
          height="480"
          loading="lazy"
          decoding="async"
        />
        <span className="home-inspiration-tag">
          <UiIcon icon={categoryIcons[item.category]} size="small" />
          {t.categories[item.category]}
        </span>
        {/* 悬停时卡内升起玻璃面板；面板属于卡片按钮，点它也打开详情。 */}
        <span className="home-inspiration-panel" aria-hidden="true">
          <strong>{item.title}</strong>
          <span className="home-inspiration-panel-prompt">{item.prompt}</span>
        </span>
      </Button>
      {/* “做同款”与卡片按钮并列（按钮不能嵌套），定位在玻璃面板左下角。 */}
      <Button
        size="sm"
        variant="primary"
        className="home-inspiration-cta"
        aria-label={t.useNamed(item.title)}
        onPress={onUse}
      >
        {t.use}
      </Button>
    </motion.div>
  );
}
