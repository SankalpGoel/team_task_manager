import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, MessageSquare, CheckSquare } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/features/tasks/api";
import { cn, initials } from "@/lib/utils";

const priorityClass: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const overdue =
    task.due_date && task.status !== "done" && isPast(parseISO(`${task.due_date}T23:59:59`));

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</p>
      </div>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: l.color + "22", color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("border-transparent text-[10px]", priorityClass[task.priority])}>
            {task.priority}
          </Badge>
          {task.due_date && (
            <span
              className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium")}
            >
              <Calendar className="h-3 w-3" />
              {format(parseISO(`${task.due_date}T00:00:00`), "MMM d")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.subtask_total > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {task.subtask_done}/{task.subtask_total}
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {task.comment_count}
            </span>
          )}
          {task.assignee && (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px]">
                {initials(task.assignee.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
