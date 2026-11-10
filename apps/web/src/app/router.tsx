import { mainImageModelIds } from "@lycoboai/contracts";
import { createBrowserRouter, redirect } from "react-router";
import {
  getRecentCommerceTool,
  rememberCommerceTool,
} from "../features/commerce/commerce-preferences";
import { useStudioStore } from "../features/generation/studio-state";
import { useWorkspaceState } from "../features/workspace/workspace-state";
import { PageLoading } from "./page-loading";
import { PageNotFound, PageUnavailable } from "./page-states";

export const router = createBrowserRouter([
  {
    path: "/login",
    HydrateFallback: PageLoading,
    lazy: async () => ({
      Component: (await import("../features/auth/login-page")).LoginPage,
    }),
  },
  {
    path: "/chatdraw",
    loader: ({ request }) => redirect(`/commerce/create${new URL(request.url).search}`),
  },
  {
    path: "/design/:view?",
    loader: ({ params }) => redirect(params.view === "assets" ? "/assets" : "/"),
  },
  ...["history", "canvas", "projects", "templates", "library"].map((path) => ({
    path,
    loader: () => redirect("/"),
  })),
  {
    path: "/",
    HydrateFallback: PageLoading,
    errorElement: <PageUnavailable />,
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
            path: "commerce/create",
            lazy: async () => ({
              Component: (await import("../features/generation/workspace-page")).WorkspacePage,
            }),
          },
          {
            path: "commerce/create/:model",
            loader: ({ params, request }) => {
              const model = params.model === "gpt-image" ? "gpt-image-2" : params.model;
              if (!mainImageModelIds.some((id) => id === model) || !model)
                throw new Response("Not found", { status: 404 });
              useStudioStore.getState().setActiveModel(model);
              return redirect(`/commerce/create${new URL(request.url).search}`);
            },
          },
          {
            path: "video",
            lazy: async () => ({
              Component: (await import("../features/video/video-page")).VideoPage,
            }),
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
        path: "membership",
        lazy: async () => ({
          Component: (await import("../features/account/membership/membership-page"))
            .MembershipPage,
        }),
      },
      {
        path: "assets",
        lazy: async () => ({
          Component: (await import("../features/assets/assets-page")).AssetsPage,
        }),
      },
      {
        path: "inspiration",
        lazy: async () => ({
          Component: (await import("../features/home/inspiration-library-page"))
            .InspirationLibraryPage,
        }),
      },
      {
        path: "terms",
        lazy: async () => ({
          Component: (await import("../features/legal/legal-page")).TermsPage,
        }),
      },
      {
        path: "privacy",
        lazy: async () => ({
          Component: (await import("../features/legal/legal-page")).PrivacyPage,
        }),
      },
      {
        path: "*",
        element: <PageNotFound />,
      },
    ],
  },
]);
