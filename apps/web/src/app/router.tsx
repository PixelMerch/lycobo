import { EmptyState, Link } from "@heroui/react";
import { createBrowserRouter, redirect } from "react-router";
import { isModelId, useStudioStore } from "../features/generation/studio-state";
import { PageLoading } from "./page-loading";

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
    HydrateFallback: PageLoading,
    errorElement: (
      <EmptyState className="empty-state">
        <h1>页面暂时无法打开</h1>
        <Link href="/">返回首页</Link>
      </EmptyState>
    ),
    lazy: async () => ({
      Component: (await import("./studio-shell")).StudioShell,
    }),
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("../features/home/home-page")).HomePage }),
      },
      {
        path: "create",
        lazy: async () => ({
          Component: (await import("../features/generation/workspace-page")).WorkspacePage,
        }),
      },
      {
        path: "create/:model",
        loader: ({ params, request }) => {
          const model = params.model === "gpt-image" ? "gpt-image-2" : params.model;
          if (!isModelId(model)) throw new Response("Not found", { status: 404 });
          useStudioStore.getState().setActiveModel(model);
          return redirect(`/create${new URL(request.url).search}`);
        },
      },
      {
        path: "assets",
        lazy: async () => ({
          Component: (await import("../features/assets/assets-page")).AssetsPage,
        }),
      },
      {
        path: "*",
        element: (
          <EmptyState className="empty-state">
            <h1>页面不存在</h1>
            <Link href="/">返回首页</Link>
          </EmptyState>
        ),
      },
    ],
  },
]);
