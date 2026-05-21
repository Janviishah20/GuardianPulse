import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { Layout } from "./components/Layout";
// AuthGuard is exported for potential external use

import { useInternetIdentity } from "@caffeineai/core-infrastructure";
// ─── Lazy page imports ────────────────────────────────────────────────────────
import { Suspense, lazy, useEffect } from "react";
import type React from "react";

const INTRO_SEEN_KEY = "guardianpulse_intro_seen";

const DetectionPage = lazy(() =>
  import("./pages/DetectionPage").then((m) => ({ default: m.DetectionPage })),
);
const FloorPlanPage = lazy(() =>
  import("./pages/FloorPlanPage").then((m) => ({ default: m.FloorPlanPage })),
);
const ManifestPage = lazy(() =>
  import("./pages/ManifestPage").then((m) => ({ default: m.ManifestPage })),
);
const IntroPage = lazy(() =>
  import("./pages/IntroPage").then((m) => ({ default: m.IntroPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);

// ─── Loading fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div
      className="flex-1 flex items-center justify-center bg-background"
      data-ocid="app.loading_state"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
          Loading…
        </span>
      </div>
    </div>
  );
}

// ─── Auth guard hook ──────────────────────────────────────────────────────────
function useAuthGuard(): boolean {
  const { isAuthenticated } = useInternetIdentity();
  return isAuthenticated;
}

// ─── Root layout — conditionally wraps in Layout based on current route ────────
function RootLayout() {
  const location = useRouterState({ select: (s) => s.location });
  const isIntro = location.pathname === "/intro";
  const isLogin = location.pathname === "/login";

  if (isIntro || isLogin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

// ─── Route tree ───────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: RootLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const introRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/intro",
  component: IntroPage,
});

// Wrap a page component in AuthGuard (lazy pages need their own Suspense)
function withAuth(Page: React.ComponentType) {
  return function AuthWrapped() {
    return (
      <AuthGuard>
        <Suspense fallback={<PageLoader />}>
          <Page />
        </Suspense>
      </AuthGuard>
    );
  };
}

// Detection route — redirect to /intro if first visit (auth handled by AuthGuard wrapper)
const detectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    if (!localStorage.getItem(INTRO_SEEN_KEY)) {
      throw redirect({ to: "/intro" });
    }
  },
  component: () => (
    <AuthGuard>
      <Suspense fallback={<PageLoader />}>
        <DetectionPage />
      </Suspense>
    </AuthGuard>
  ),
});

const floorPlanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/floorplan",
  component: withAuth(FloorPlanPage),
});

const manifestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/manifest",
  component: withAuth(ManifestPage),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  introRoute,
  detectionRoute,
  floorPlanRoute,
  manifestRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ─── React Query client ───────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// ─── Dark mode enforcement ────────────────────────────────────────────────────
function DarkModeEnforcer() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dark");
    html.style.colorScheme = "dark";
  }, []);
  return null;
}

// ─── Auth route guard component ───────────────────────────────────────────────
// Wraps protected pages and redirects to /login if not authenticated
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthGuard();

  useEffect(() => {
    if (!isAuthenticated) {
      router.navigate({ to: "/login" });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <PageLoader />;
  }

  return <>{children}</>;
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DarkModeEnforcer />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
