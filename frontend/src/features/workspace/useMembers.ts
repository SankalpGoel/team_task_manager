import { useQuery } from "@tanstack/react-query";

import { listMembers } from "@/features/workspace/api";
import { useAuthStore } from "@/store/authStore";

/** Members of the currently active workspace. Shared by the assignee picker and
 *  @mention autocomplete. Any member can read the roster. */
export function useWorkspaceMembers() {
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => listMembers(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}
