import { Tabs } from "@heroui/react";
import type { ReactNode } from "react";
import { SelectionPill } from "../../components/selection-pill";
import { useMessages } from "../../i18n/messages";
import { assetsMessages } from "./assets-messages";
import "./asset-library-tabs.css";

/** 素材库的两个标签：我的素材、灵感库。 */
export type AssetLibraryTab = "mine" | "inspiration";
const tabs = ["mine", "inspiration"] as const satisfies readonly AssetLibraryTab[];

/** 把地址栏或外部传来的值收成素材库的标签，认不出时回到我的素材。 */
export function assetLibraryTab(value: unknown): AssetLibraryTab {
  return tabs.find((tab) => tab === value) ?? "mine";
}

/**
 * 素材库弹窗和页面共用文字标签，下划线沿用分类的弹簧动效。
 * 弹窗的关闭按钮放在标题栏末端。
 */
export function AssetLibraryTabs({
  tab,
  endAction,
  mine,
  inspiration,
  onTabChange,
}: {
  tab: AssetLibraryTab;
  endAction?: ReactNode;
  mine: ReactNode;
  inspiration: ReactNode;
  onTabChange: (tab: AssetLibraryTab) => void;
}) {
  const t = useMessages(assetsMessages);
  return (
    <Tabs
      className="asset-library-tabs"
      data-library-tab={tab}
      selectedKey={tab}
      onSelectionChange={(key) => onTabChange(assetLibraryTab(key))}
    >
      <div className="asset-library-head">
        <Tabs.List
          className="asset-library-entry-tabs"
          aria-label={t.libraryTitle}
          render={({ children, ...props }) => (
            <div {...props}>
              {children}
              <SelectionPill value={tab} />
            </div>
          )}
        >
          {tabs.map((id) => (
            <Tabs.Tab key={id} id={id}>
              {id === "mine" ? t.myAssets : t.inspiration}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {endAction}
      </div>
      <Tabs.Panel id="mine" className="asset-library-panel">
        {mine}
      </Tabs.Panel>
      <Tabs.Panel id="inspiration" className="asset-library-panel asset-library-inspiration">
        {inspiration}
      </Tabs.Panel>
    </Tabs>
  );
}
