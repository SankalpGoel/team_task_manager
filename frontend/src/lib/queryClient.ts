import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // reuse cached data when revisiting a page
      staleTime: 120_000, // cached data stays fresh for 2 min (cuts repeat round-trips)
      gcTime: 10 * 60_000,
    },
  },
});
