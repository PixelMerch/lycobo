import { useEffect } from "react";
import { useMessages } from "../../i18n/messages";
import { SiteFooter } from "../site/site-footer";
import { HomeInspirationGallery } from "./home-inspiration-gallery";
import { homeInspirationMessages } from "./home-inspiration-messages";
import "./inspiration-library-page.css";

/** 灵感库：一次显示全部灵感示例的瀑布流，与首页作品墙共用卡片、详情和“做同款”；未登录也能浏览。 */
export function InspirationLibraryPage() {
  const t = useMessages(homeInspirationMessages);
  // 在别的页面滚到半截时点顶部导航“灵感”进来，也从页面顶部开始看。
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="inspiration-library">
      <header className="inspiration-library-header">
        <h1>{t.libraryTitle}</h1>
        <p>{t.libraryIntro}</p>
      </header>
      <HomeInspirationGallery library />
      <SiteFooter />
    </div>
  );
}
