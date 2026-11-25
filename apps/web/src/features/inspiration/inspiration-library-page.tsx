import { useLayoutEffect } from "react";
import { initializePageScrollbar } from "../../components/page-scrollbar";
import "../../components/page-scrollbar.css";
import { SiteFooter } from "../site/site-footer";
import { HomeInspirationGallery } from "./home-inspiration-gallery";
import "./inspiration-library-page.css";

/** 灵感库显示完整作品墙，并沿用首页的浮动滚动条。 */
export function InspirationLibraryPage() {
  // 从其他页面通过导航进入灵感库时，从页面顶部开始浏览。
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    return initializePageScrollbar();
  }, []);
  return (
    <div className="inspiration-library">
      <HomeInspirationGallery standalone />
      <SiteFooter />
    </div>
  );
}
