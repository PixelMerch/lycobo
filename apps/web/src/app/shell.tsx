import { IconBulb, IconFolder, IconHome, IconListCheck, IconPhoto } from "@tabler/icons-react";
import { NavLink, Outlet } from "react-router";

const navigation = [
  { to: "/", label: "开始创作", Icon: IconHome },
  { to: "/tasks", label: "任务中心", Icon: IconListCheck },
  { to: "/projects", label: "我的项目", Icon: IconFolder },
  { to: "/inspiration", label: "案例灵感", Icon: IconBulb },
  { to: "/assets", label: "作品库", Icon: IconPhoto },
];
export function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        跳转到主要内容
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="lycoboai 首页">
          <span className="brand-symbol" aria-hidden="true">
            L
          </span>
          lycoboai
        </NavLink>
        <nav aria-label="主导航">
          {navigation.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-note">电商创作工作台</p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>创作空间</span>
          <span className="environment-label">开发预览</span>
        </header>
        <main id="main" className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
