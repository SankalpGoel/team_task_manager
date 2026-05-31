import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CommentThread } from "@/components/task/CommentThread";
import { LabelPicker } from "@/components/task/LabelPicker";
import { SubtaskChecklist } from "@/components/task/SubtaskChecklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceMembers } from "@/features/workspace/useMembers";
import { aiTaskDraft, aiUnavailable } from "@/features/ai/api";
import { deleteTask, getTask, updateTask } from "@/features/tasks/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { TaskPriority, TaskStatus } from "@/types/api";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface TaskDrawerProps {
  taskId: string | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDrawer({ taskId, projectId, open, onOpenChange }: TaskDrawerProps) {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.activeRole());
  const isManagerPlus = role === "admin" || role === "manager";
  const { data: members = [] } = useWorkspaceMembers();

  const taskQuery = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId as string),
    enabled: !!taskId && open,
  });
  const task = taskQuery.data;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
  };

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateTask>[1]) =>
      updateTask(taskId as string, payload),
    onSuccess: invalidate,
    onError: (e) => {
      toast.error(getApiErrorMessage(e));
      taskQuery.refetch();
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteTask(taskId as string),
    onSuccess: () => {
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const draftMut = useMutation({
    mutationFn: () => aiTaskDraft(title.trim() || task?.title || "Untitled", description || undefined),
    onSuccess: (res) => {
      if (aiUnavailable(res.provider_used)) {
        toast.message(res.description || "AI is not configured.");
        return;
      }
      let next = res.description;
      if (res.acceptance_criteria.length > 0) {
        next += `\n\nAcceptance criteria:\n${res.acceptance_criteria.map((c) => `- ${c}`).join("\n")}`;
      }
      setDescription(next);
      updateMut.mutate({ description: next });
      toast.success(`Drafted with ${res.provider_used}${res.cached ? " (cached)" : ""}`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const saveTitle = () => {
    const t = title.trim();
    if (task && t && t !== task.title) updateMut.mutate({ title: t });
  };
  const saveDescription = () => {
    if (task && description !== (task.description ?? "")) {
      updateMut.mutate({ description: description || null });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0">
        {!task ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 py-4 pr-12">
              <SheetTitle className="sr-only">Task detail</SheetTitle>
              <SheetDescription className="sr-only">
                View and edit task details, subtasks and comments.
              </SheetDescription>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                maxLength={160}
                className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              />
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <select
                    className={selectClass}
                    value={task.status}
                    onChange={(e) => updateMut.mutate({ status: e.target.value as TaskStatus })}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <select
                    className={selectClass}
                    value={task.priority}
                    onChange={(e) =>
                      updateMut.mutate({ priority: e.target.value as TaskPriority })
                    }
                  >
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Assignee</Label>
                  <select
                    className={selectClass}
                    value={task.assignee?.id ?? ""}
                    onChange={(e) =>
                      updateMut.mutate({ assignee_id: e.target.value || null })
                    }
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Due date</Label>
                  <Input
                    type="date"
                    className="h-9"
                    value={task.due_date ?? ""}
                    onChange={(e) => updateMut.mutate({ due_date: e.target.value || null })}
                  />
                </div>
              </div>

              <LabelPicker taskId={task.id} projectId={projectId} attached={task.labels} />

              {/* Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={draftMut.isPending}
                    onClick={() => draftMut.mutate()}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    {draftMut.isPending ? "Drafting…" : "Draft with AI"}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  value={description}
                  maxLength={5000}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  placeholder="Add a description…"
                />
              </div>

              <SubtaskChecklist
                taskId={task.id}
                projectId={projectId}
                subtasks={task.subtasks}
              />

              <CommentThread taskId={task.id} projectId={projectId} />
            </div>

            <div className="flex items-center justify-between border-t px-6 py-3">
              <span className="text-xs text-muted-foreground">
                Created {format(parseISO(task.created_at), "MMM d, yyyy")}
              </span>
              {isManagerPlus && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    if (confirm("Delete this task? This cannot be undone.")) deleteMut.mutate();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete task
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
