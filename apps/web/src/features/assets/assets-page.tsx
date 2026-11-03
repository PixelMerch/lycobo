import { useSearchParams } from "react-router";
import { AssetBrowser } from "./asset-browser";
import { defaultAssetFilters, filtersFromSearch, filtersToSearch } from "./asset-library-client";

/** 素材库: every tool's generated history, uploads and the member's favorites. */
export function AssetsPage() {
  const [search, setSearch] = useSearchParams();
  return (
    <section className="assets-page">
      <header className="assets-page-heading">
        <h1>素材库</h1>
        <p>全部功能生成过的图片，以及上传和收藏的素材</p>
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
