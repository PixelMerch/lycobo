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
 * 素材库的标签行与内容，弹窗和素材库页面共用：标签就是标题，lead 放在标签前面（弹窗的关闭按钮），
 * 只渲染当前标签的内容。
 */
export function AssetLibraryTabs({
  tab,
  lead,
  mine,
  inspiration,
  onTabChange,
}: {
  tab: AssetLibraryTab;
  lead?: ReactNode;
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
        {lead}
        <Tabs.List
          className="pill-tab-list"
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
