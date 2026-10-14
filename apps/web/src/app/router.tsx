import { createBrowserRouter, Link } from "react-router";
import { AppShell } from "./shell";
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    HydrateFallback: () => (
      <main className="empty-state" role="status">
        正在打开创作空间…
      </main>
    ),
    errorElement: (
      <main className="empty-state">
        <h1>页面暂时无法打开</h1>
        <p>请重新进入创作工作台。</p>
        <a href="/">返回首页</a>
      </main>
    ),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("../features/create/create-page")).CreatePage,
        }),
      },
      {
        path: "tasks",
        lazy: async () => ({ Component: (await import("../features/tasks/tasks-page")).TasksPage }),
      },
      ...(["projects", "inspiration", "assets"] as const).map((path) => ({
        path,
        lazy: async () => ({
          Component: (await import("../features/library/library-page")).LibraryPage,
        }),
      })),
      {
        path: "*",
        element: (
          <section className="empty-state">
            <h1>找不到这个页面</h1>
            <Link to="/">返回创作</Link>
          </section>
        ),
      },
    ],
  },
]);
