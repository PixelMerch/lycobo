import { useSearchParams } from "react-router";
import { useMessages } from "../../i18n/messages";
import { HomeInspirationGallery } from "../home/home-inspiration-gallery";
import { AssetBrowser } from "./asset-browser";
import { filtersFromSearch, filtersToSearch } from "./asset-library-client";
import { AssetLibraryTabs, assetLibraryTab } from "./asset-library-tabs";
import { assetsMessages } from "./assets-messages";

/** 素材库页面：我的素材（生成、上传与收藏）和灵感库两个标签；标签与筛选都写在地址栏里。 */
export function AssetsPage() {
  const [search, setSearch] = useSearchParams();
  const t = useMessages(assetsMessages);
  const tab = assetLibraryTab(search.get("tab"));
  return (
    <section className="assets-page">
      <h1 className="sr-only">{t.libraryTitle}</h1>
      <AssetLibraryTabs
        tab={tab}
        onTabChange={(next) => {
          // 切到灵感库时保留我的素材的筛选，切回来还是原来的视图。
          const params = new URLSearchParams(search);
          if (next === "inspiration") params.set("tab", next);
          else params.delete("tab");
          setSearch(params, { replace: true });
        }}
        mine={
          <AssetBrowser
            filters={filtersFromSearch(search)}
            headingLevel={2}
            onChange={(next) => setSearch(filtersToSearch(next), { replace: true })}
          />
        }
        inspiration={<HomeInspirationGallery library note={t.inspirationNote} />}
      />
    </section>
  );
}
