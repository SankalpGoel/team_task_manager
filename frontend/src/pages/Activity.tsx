import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { listActivity, type Activity } from "@/features/activity/api";
import { useAuthStore } from "@/store/authStore";
import { initials } from "@/lib/utils";

const VERB_PHRASE: Record<string, string> = {
  "task.created": "created a task",
  "task.updated": "updated a task",
  "task.moved": "moved a task",
  "task.deleted": "deleted a task",
  "task.assigned": "reassigned a task",
  "comment.created": "commented on a task",
};

function describe(a: Activity): string {
  const phrase = VERB_PHRASE[a.verb] ?? a.verb.replace(/[._]/g, " ");
  const title = (a.meta?.title as string | undefined) ?? undefined;
  const status = (a.meta?.status as string | undefined) ?? undefined;
  if (a.verb === "task.created" && title) return `created “${title}”`;
  if (a.verb === "task.moved" && status) return `moved a task to ${status.replace("_", " ")}`;
  return phrase;
}

export default function ActivityPage() {
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);

  const query = useQuery({
    queryKey: ["activity", workspaceId],
    queryFn: () => listActivity(workspaceId as string, 100),
    enabled: !!workspaceId,
  });

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Activity</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Recent changes across this workspace.
      </p>

      {query.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !query.data || query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="space-y-1">
          {query.data.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60"
            >
              <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {initials(a.actor?.full_name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{a.actor?.full_name ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">{describe(a)}</span>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(parseISO(a.created_at), { addSuffix: true })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
