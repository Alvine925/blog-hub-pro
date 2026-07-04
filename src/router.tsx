import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSkeleton } from "./components/ui/page-skeleton";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes — eliminates unnecessary
        // re-fetches on revisits and saves Supabase egress.
        staleTime: 5 * 60 * 1000,
        // Keep data in memory for 30 minutes after the last subscriber
        // unmounts, so navigating back is instant even after a while.
        gcTime: 30 * 60 * 1000,
        // Retry once on transient errors (Supabase cold starts, etc.)
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Show skeleton immediately — no artificial 1-second delay.
    defaultPendingMs: 0,
    // Any route that doesn't define its own pendingComponent falls back here.
    defaultPendingComponent: PageSkeleton,
  });

  return router;
};
