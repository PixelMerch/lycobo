import { useSearchParams } from "react-router";
import { useMessages } from "../../i18n/messages";
import { AssetBrowser } from "./asset-browser";
import { defaultAssetFilters, filtersFromSearch, filtersToSearch } from "./asset-library-client";
import { assetsMessages } from "./assets-messages";

/** 素材库：全部工具的生成记录、上传的素材与成员收藏。 */
export function AssetsPage() {
  const [search, setSearch] = useSearchParams();
  const t = useMessages(assetsMessages);
  return (
    <section className="assets-page">
      <header className="assets-page-heading">
        <h1>{t.pageTitle}</h1>
        <p>{t.pageLead}</p>
      </header>
      <AssetBrowser
        filters={filtersFromSearch(search)}
        defaults={defaultAssetFilters}
        headingLevel={2}
        onChange={(next) => setSearch(filtersToSearch(next), { replace: true })}
      />
    </section>
  );
}
