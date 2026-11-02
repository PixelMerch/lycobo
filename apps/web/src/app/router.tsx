import { EmptyState, Link } from "@heroui/react";
import { createBrowserRouter, redirect } from "react-router";
import { accountCenterTabs } from "../features/account/account-center-tabs";
import {
  getRecentCommerceTool,
  rememberCommerceTool,
} from "../features/commerce/commerce-preferences";
import { isModelId, useStudioStore } from "../features/generation/studio-state";
import { useWorkspaceState } from "../features/workspace/workspace-state";
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
      { path: "workspace", loader: () => redirect(useWorkspaceState.getState().lastPath) },
      {
        lazy: async () => ({
          Component: (await import("../features/workspace/workspace-layout")).WorkspaceLayout,
        }),
        children: [
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
            path: "commerce",
            loader: () => redirect(getRecentCommerceTool().href),
          },
          {
            path: "commerce/textile-set",
            loader: () => {
              rememberCommerceTool("textile-set");
              return null;
            },
            lazy: async () => ({
              Component: (await import("../features/commerce/textile-set/textile-set-page"))
                .TextileSetPage,
            }),
          },
          {
            path: "commerce/smart-variation",
            loader: () => {
              rememberCommerceTool("smart-variation");
              return null;
            },
            lazy: async () => ({
              Component: (await import("../features/commerce/smart-variation/smart-variation-page"))
                .SmartVariationPage,
            }),
          },
        ],
      },
      {
        path: "account/:tab?",
        loader: ({ params }) =>
          params.tab && !accountCenterTabs.some((item) => item.path === params.tab)
            ? redirect("/account")
            : null,
        lazy: async () => ({
          Component: (await import("../features/account/account-center-page")).AccountCenterPage,
        }),
      },
      {
        path: "membership",
        lazy: async () => ({
          Component: (await import("../features/account/membership-page")).MembershipPage,
        }),
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
