import { createBrowserRouter, Link, redirect } from "react-router";
import { isModelId, useStudioStore } from "../features/studio/studio-state";

export const router = createBrowserRouter([
  {
    path: "/chatdraw",
    loader: ({ request }) => redirect(`/create${new URL(request.url).search}`),
  },
  {
    path: "/design/:view?",
    loader: ({ params }) => redirect(params.view === "assets" ? "/assets" : "/"),
  },
  ...["history", "canvas", "projects", "inspiration", "templates", "library"].map((path) => ({
    path,
    loader: () => redirect("/"),
  })),
  {
    path: "/",
    HydrateFallback: () => (
      <main className="empty-state" role="status">
        正在加载…
      </main>
    ),
    errorElement: (
      <main className="empty-state">
        <h1>页面暂时无法打开</h1>
        <Link to="/">返回首页</Link>
      </main>
    ),
    lazy: async () => ({
      Component: (await import("../features/studio/studio-shell")).StudioShell,
    }),
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("../features/studio/home-page")).HomePage }),
      },
      {
        path: "create",
        lazy: async () => ({
          Component: (await import("../features/studio/workspace-page")).WorkspacePage,
        }),
      },
      {
        path: "create/:model",
        loader: ({ params, request }) => {
          if (!isModelId(params.model)) throw new Response("Not found", { status: 404 });
          useStudioStore.getState().setActiveModel(params.model);
          return redirect(`/create${new URL(request.url).search}`);
        },
      },
      {
        path: "assets",
        lazy: async () => ({
          Component: (await import("../features/studio/assets-page")).AssetsPage,
        }),
      },
      {
        path: "*",
        element: (
          <section className="empty-state">
            <h1>页面不存在</h1>
            <Link to="/">返回首页</Link>
          </section>
        ),
      },
    ],
  },
]);
