import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchMe } from "@/features/auth/api";
import { useAuthStore } from "@/store/authStore";

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    enabled: !!accessToken,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data.user, query.data.memberships);
    }
  }, [query.data, setUser]);

  return query;
}
