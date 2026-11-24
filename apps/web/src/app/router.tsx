import { mainImageModelIds } from "@lycoboai/contracts";
import { createBrowserRouter, type LoaderFunctionArgs, type RouteObject } from "react-router";
import { getRecentCommercePath } from "../features/commerce/commerce-preferences";
import { useStudioStore } from "../features/generation/studio-state";
import {
  dashboardAssetsPath,
  dashboardPages,
  dashboardPath,
  dashboardToolPaths,
  freeCanvasPath,
} from "../lib/dashboard-paths";
import {
  loadRouteLocale,
  localizedRedirect,
  normalizeInitialLocalePath,
  redirectCommerceToHome,
  redirectPreservingLocation,
  redirectToLocale,
} from "./locale-route";
import { PageLoading } from "./page-loading";
import { PageNotFound, RouteErrorPage } from "./page-states";

function redirectMainImageModel({ params, request }: LoaderFunctionArgs) {
  const model = params.model === "gpt-image" ? "gpt-image-2" : params.model;
  if (!model || !mainImageModelIds.some((id) => id === model))
    throw new Response("Not found", { status: 404 });
  useStudioStore.getState().setActiveModel(model);
  return redirectPreservingLocation(request, dashboardToolPaths.create);
}

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
    loader: ({ request }) => redirectPreservingLocation(request, dashboardToolPaths.create),
  },
  {
    path: "design/:view?",
    loader: ({ params, request }) =>
      redirectPreservingLocation(request, params.view === "assets" ? dashboardAssetsPath : "/"),
  },
  ...dashboardPages.map<RouteObject>((target) => ({
    path: target.slice(dashboardPath.length + 1),
    loader: ({ request }) => redirectPreservingLocation(request, target),
  })),
  ...["workspace", dashboardPath.slice(1)].map<RouteObject>((path) => ({
    path,
    loader: ({ request }) => redirectPreservingLocation(request, getRecentCommercePath()),
  })),
  ...["commerce/create", dashboardToolPaths.create.slice(1)].map<RouteObject>((path) => ({
    path: `${path}/:model`,
    loader: redirectMainImageModel,
  })),
  ...["history", "canvas", "projects", "templates", "library"].map<RouteObject>((path) => ({
    path,
    loader: ({ request }) => localizedRedirect(request, "/"),
  })),
  {
    HydrateFallback: PageLoading,
    errorElement: <RouteErrorPage />,
    lazy: async () => ({
      Component: (await import("./studio-shell")).StudioShell,
    }),
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import("../features/home/landing/landing-page")).LandingPage,
        }),
      },
      {
        path: "commerce",
        loader: ({ request }) => redirectCommerceToHome(request),
      },
      {
        lazy: async () => ({
          Component: (await import("../features/workspace/workspace-layout")).WorkspaceLayout,
        }),
        children: [
          {
            path: dashboardToolPaths.create.slice(1),
            lazy: async () => ({
              Component: (await import("../features/generation/workspace-page")).WorkspacePage,
            }),
          },
          {
            path: dashboardToolPaths.replica.slice(1),
            lazy: async () => ({
              Component: (await import("../features/commerce/replica/replica-page")).ReplicaPage,
            }),
          },
          {
            path: dashboardToolPaths.video.slice(1),
            lazy: async () => ({
              Component: (await import("../features/video/video-page")).VideoPage,
            }),
          },
          {
            path: dashboardToolPaths.textile.slice(1),
            lazy: async () => ({
              Component: (await import("../features/commerce/textile-set/textile-set-page"))
                .TextileSetPage,
            }),
          },
          {
            path: dashboardToolPaths.variation.slice(1),
            lazy: async () => ({
              Component: (await import("../features/commerce/smart-variation/smart-variation-page"))
                .SmartVariationPage,
            }),
          },
        ],
      },
      {
        path: freeCanvasPath.slice(1),
        lazy: async () => ({
          Component: (await import("../features/free-canvas/free-canvas-page")).FreeCanvasPage,
        }),
      },
      {
        path: "membership",
        lazy: async () => ({
          Component: (await import("../features/account/membership/membership-page"))
            .MembershipPage,
        }),
      },
      {
        path: dashboardAssetsPath.slice(1),
        lazy: async () => ({
          Component: (await import("../features/assets/assets-page")).AssetsPage,
        }),
      },
      {
        path: "inspiration",
        lazy: async () => ({
          Component: (await import("../features/inspiration/inspiration-library-page"))
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
        path: "refund-policy",
        lazy: async () => ({
          Component: (await import("../features/legal/legal-page")).RefundPage,
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
    errorElement: <RouteErrorPage />,
    children: localizedRoutes,
  },
  {
    path: "*",
    loader: ({ request }) => redirectToLocale(request),
    HydrateFallback: PageLoading,
    errorElement: <RouteErrorPage />,
  },
]);
