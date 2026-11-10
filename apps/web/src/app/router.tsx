import { mainImageModelIds } from "@lycoboai/contracts";
import { createBrowserRouter, type RouteObject } from "react-router";
import {
  getRecentCommerceTool,
  rememberCommerceTool,
} from "../features/commerce/commerce-preferences";
import { useStudioStore } from "../features/generation/studio-state";
import { useWorkspaceState } from "../features/workspace/workspace-state";
import {
  loadRouteLocale,
  localizedRedirect,
  normalizeInitialLocalePath,
  redirectToLocale,
} from "./locale-route";
import { PageLoading } from "./page-loading";
import { PageNotFound, PageUnavailable } from "./page-states";

const localizedRoutes: RouteObject[] = [
  {
    path: "login",
    HydrateFallback: PageLoading,
    lazy: async () => ({
      Component: (await import("../features/auth/login-page")).LoginPage,
    }),
  },
  {
    path: "chatdraw",
    loader: ({ request }) =>
      localizedRedirect(request, `/commerce/create${new URL(request.url).search}`),
  },
  {
    path: "design/:view?",
    loader: ({ params, request }) =>
      localizedRedirect(request, params.view === "assets" ? "/assets" : "/"),
  },
  ...["history", "canvas", "projects", "templates", "library"].map<RouteObject>((path) => ({
    path,
    loader: ({ request }) => localizedRedirect(request, "/"),
  })),
  {
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
      {
        path: "workspace",
        loader: ({ request }) => localizedRedirect(request, useWorkspaceState.getState().lastPath),
      },
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
              return localizedRedirect(request, `/commerce/create${new URL(request.url).search}`);
            },
          },
          {
            path: "commerce/replica",
            lazy: async () => ({
              Component: (await import("../features/commerce/replica/replica-page")).ReplicaPage,
            }),
          },
          {
            path: "video",
            lazy: async () => ({
              Component: (await import("../features/video/video-page")).VideoPage,
            }),
          },
          {
            path: "commerce",
            loader: ({ request }) => localizedRedirect(request, getRecentCommerceTool().href),
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
];

normalizeInitialLocalePath();

/** 语言作为共享父级参数，切换时保留当前页面、草稿与应用壳。 */
export const router = createBrowserRouter([
  {
    id: "localized-app",
    path: "/:locale",
    loader: loadRouteLocale,
    HydrateFallback: PageLoading,
    errorElement: <PageNotFound />,
    children: localizedRoutes,
  },
  {
    path: "*",
    loader: ({ request }) => redirectToLocale(request),
    HydrateFallback: PageLoading,
    errorElement: <PageNotFound />,
  },
]);
