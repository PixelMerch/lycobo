import { IconFolder } from "@tabler/icons-react";
import { useLocation } from "react-router";

const titles: Record<string, string> = {
  "/projects": "我的项目",
  "/inspiration": "案例灵感",
  "/assets": "作品库",
};
export function LibraryPage() {
  const { pathname } = useLocation();
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">创作空间</p>
          <h1>{titles[pathname]}</h1>
        </div>
      </div>
      <div className="surface empty-state">
        <IconFolder size={32} aria-hidden="true" />
        <h2>内容服务尚未接入</h2>
        <p>这里将展示你的项目、案例或作品，当前没有加载业务数据。</p>
      </div>
    </section>
  );
}
