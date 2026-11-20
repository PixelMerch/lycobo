import { useEffect } from "react";
import { SiteFooter } from "../site/site-footer";
import { HomeInspirationGallery } from "./home-inspiration-gallery";
import "./inspiration-library-page.css";

/** 灵感库：一次显示全部灵感示例的瀑布流，与素材库共用卡片、详情和“做同款”；未登录也能浏览。 */
export function InspirationLibraryPage() {
  // 从其他页面通过导航进入灵感库时，从页面顶部开始浏览。
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="inspiration-library">
      <HomeInspirationGallery standalone />
      <SiteFooter />
    </div>
  );
}
