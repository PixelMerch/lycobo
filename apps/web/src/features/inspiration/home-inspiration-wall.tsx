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
import { SelectionPill } from "../../components/selection-pill";
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

// 卡片左下角的分类标签图标，与工作区工具图标保持同一风格。
const categoryIcons = {
  product: IconCamera,
  scene: IconPhoto,
  textile: IconLayoutCollage,
  creative: IconSparkles,
} satisfies Record<HomeInspiration["category"], TablerIcon>;

/** 灵感库按分类呈现完整瀑布流，复用详情与做同款操作。 */
export function InspirationWall({
  items,
  standalone,
  onOpen,
  onUse,
}: {
  items: HomeInspiration[];
  standalone: boolean;
  onOpen: (item: HomeInspiration) => void;
  onUse: (item: HomeInspiration) => void;
}) {
  const t = useMessages(homeInspirationMessages);
  const [category, setCategory] = useState<InspirationCategory>("all");
  const visible = items.filter((item) => category === "all" || item.category === category);
  const columns = distributeColumns(visible, useColumnCount(standalone));
  const tabs = inspirationCategories.map((id) => (
    <Tabs.Tab id={id} key={id}>
      {!standalone && id === category && (
        <SelectionHighlight layoutId="home-inspiration-selection" layoutDependency={category} />
      )}
      {t.categories[id]}
    </Tabs.Tab>
  ));
  return (
    <Tabs
      selectedKey={category}
      onSelectionChange={(key) => {
        const next = inspirationCategories.find((entry) => entry === key);
        if (next) setCategory(next);
      }}
    >
      <div className="home-inspiration-bar">
        {standalone ? (
          <div className="home-inspiration-filter-scroll">
            <Tabs.List
              aria-label={t.categoryList}
              render={({ children, ...props }) => (
                <div {...props}>
                  {children}
                  <SelectionPill value={category} />
                </div>
              )}
            >
              {tabs}
            </Tabs.List>
          </div>
        ) : (
          <Tabs.ListContainer>
            <Tabs.List aria-label={t.categoryList}>{tabs}</Tabs.List>
          </Tabs.ListContainer>
        )}
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
        data-inspiration-id={item.id}
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
