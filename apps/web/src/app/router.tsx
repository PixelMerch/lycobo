import { createBrowserRouter, Link, redirect } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/design/:view?",
    loader: ({ params, request }) =>
      redirect(`/${params.view ?? ""}${new URL(request.url).search}`),
  },
  {
    path: "/:view?",
    loader: ({ params }) => {
      if (
        params.view &&
        ![
          "tasks",
          "history",
          "projects",
          "inspiration",
          "templates",
          "assets",
          "library",
          "canvas",
        ].includes(params.view)
      ) {
        throw new Response("Not found", { status: 404 });
      }
      return null;
    },
    HydrateFallback: () => (
      <main className="empty-state" role="status">
        正在加载…
      </main>
    ),
    errorElement: (
      <main className="empty-state">
        <h1>页面暂时无法打开</h1>
        <Link to="/">返回创作首页</Link>
      </main>
    ),
    lazy: async () => ({
      Component: (await import("../features/design/design-page")).DesignPage,
    }),
  },
]);
