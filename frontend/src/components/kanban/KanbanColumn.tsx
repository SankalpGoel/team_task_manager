import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/kanban/TaskCard";
import type { Task } from "@/features/tasks/api";
import type { TaskStatus } from "@/types/api";
import { cn } from "@/lib/utils";

const COLUMN_TITLES: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

const COLUMN_TINT: Record<TaskStatus, string> = {
  todo: "border-slate-300",
  in_progress: "border-blue-300",
  in_review: "border-amber-300",
  done: "border-emerald-300",
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onCreate?: (status: TaskStatus) => void;
  onTaskClick?: (task: Task) => void;
}

export function KanbanColumn({ status, tasks, onCreate, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });
  const ids = tasks.map((t) => t.id);

  return (
    <div
      className={cn(
        "flex h-full min-h-[200px] w-72 shrink-0 flex-col rounded-lg border-t-4 bg-muted/40",
        COLUMN_TINT[status],
        isOver && "bg-muted",
      )}
    >
      <div className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{COLUMN_TITLES[status]}</h3>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {onCreate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCreate(status)}
            aria-label="Add task"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div ref={setNodeRef} className="flex min-h-[60px] flex-1 flex-col gap-2 p-3">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="grid flex-1 place-items-center rounded-md border border-dashed text-xs text-muted-foreground">
              Drop tasks here
            </div>
          ) : (
            tasks.map((t) => (
              <TaskCard key={t.id} task={t} onClick={() => onTaskClick?.(t)} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
