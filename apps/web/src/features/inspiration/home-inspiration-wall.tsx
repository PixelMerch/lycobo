import { Button, EmptyState, Tabs } from "@heroui/react";
import { IconSearchOff } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { CommandButton } from "../../components/command-button";
import { SelectionPill } from "../../components/selection-pill";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import {
  type HomeInspiration,
  type InspirationCategory,
  inspirationCategories,
} from "./home-inspiration-data";
import { homeInspirationMessages } from "./home-inspiration-messages";
import { distributeColumns, useColumnCount } from "./inspiration-columns";

/** 灵感库按分类呈现完整瀑布流，复用详情与做同款操作。 */
export function InspirationWall({
  items,
  onOpen,
  onUse,
}: {
  items: HomeInspiration[];
  onOpen: (item: HomeInspiration) => void;
  onUse: (item: HomeInspiration) => void;
}) {
  const t = useMessages(homeInspirationMessages);
  const [category, setCategory] = useState<InspirationCategory>("all");
  const [query, setQuery] = useState("");
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visible = items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    const text = `${item.title} ${t.categories[item.category]} ${item.prompt}`.toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
  const columns = distributeColumns(visible, useColumnCount());
  return (
    <Tabs
      selectedKey={category}
      onSelectionChange={(key) => {
        const next = inspirationCategories.find((entry) => entry === key);
        if (next) setCategory(next);
      }}
    >
      <div className="home-inspiration-bar">
        <div className="pill-scroll">
          <Tabs.List
            className="pill-tab-list"
            aria-label={t.categoryList}
            render={({ children, ...props }) => (
              <div {...props}>
                {children}
                <SelectionPill value={category} />
              </div>
            )}
          >
            {inspirationCategories.map((id) => (
              <Tabs.Tab id={id} key={id}>
                {t.categories[id]}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </div>
        <CommandButton
          label={t.search}
          placeholder={t.searchPlaceholder}
          closeLabel={t.closeSearch}
          query={query}
          onQueryChange={setQuery}
        />
      </div>
      <Tabs.Panel id={category}>
        {!visible.length && (
          <EmptyState className="empty-state home-inspiration-no-results">
            <UiIcon icon={IconSearchOff} size="illustration" />
            <p role="status">{t.noSearchResults}</p>
          </EmptyState>
        )}
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
        {/* 卡片内的标题与图片一起打开详情。 */}
        <span className="home-inspiration-panel" aria-hidden="true">
          <strong>{item.title}</strong>
        </span>
      </Button>
      {/* “做同款”与卡片按钮并列（按钮不能嵌套），定位在图片左下角。 */}
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
