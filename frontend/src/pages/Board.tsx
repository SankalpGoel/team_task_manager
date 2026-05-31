import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskCreateDialog } from "@/components/TaskCreateDialog";
import { TaskDrawer } from "@/components/task/TaskDrawer";
import { ProjectSummaryDialog } from "@/components/task/ProjectSummaryDialog";
import { getProject } from "@/features/projects/api";
import { getBoard } from "@/features/tasks/api";
import { NEW_TASK_EVENT } from "@/hooks/useKeyboardShortcuts";

export default function BoardPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [createOpen, setCreateOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Deep-link support: /projects/:id/board?task=<id> (used by @mention notifications)
  useEffect(() => {
    const t = searchParams.get("task");
    if (t) setSelectedTaskId(t);
  }, [searchParams]);

  // "c" keyboard shortcut → open the new-task dialog.
  useEffect(() => {
    const open = () => setCreateOpen(true);
    window.addEventListener(NEW_TASK_EVENT, open);
    return () => window.removeEventListener(NEW_TASK_EVENT, open);
  }, []);

  const closeDrawer = () => {
    setSelectedTaskId(null);
    if (searchParams.has("task")) {
      searchParams.delete("task");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });

  const board = useQuery({
    queryKey: ["board", projectId],
    queryFn: () => getBoard(projectId),
    enabled: !!projectId,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to projects">
            <Link to="/app/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {project.data?.name ?? <Skeleton className="inline-block h-5 w-32" />}
            </h1>
            {project.data?.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{project.data.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setSummaryOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" /> AI summary
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {board.isLoading || !board.data ? (
          <div className="flex h-full gap-3 px-1 pb-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-full w-72 shrink-0 rounded-lg" />
            ))}
          </div>
        ) : (
          <KanbanBoard
            projectId={projectId}
            board={board.data}
            onCreate={() => setCreateOpen(true)}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
          />
        )}
      </div>

      <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} projectId={projectId} />
      <ProjectSummaryDialog
        projectId={projectId}
        projectName={project.data?.name}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
      />
      <TaskDrawer
        taskId={selectedTaskId}
        projectId={projectId}
        open={!!selectedTaskId}
        onOpenChange={(o) => {
          if (!o) closeDrawer();
        }}
      />
    </div>
  );
}
