import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, Sparkles, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { aiSubtaskBreakdown, aiUnavailable } from "@/features/ai/api";
import {
  createSubtask,
  deleteSubtask,
  updateSubtask,
  type Subtask,
} from "@/features/subtasks/api";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SubtaskChecklistProps {
  taskId: string;
  projectId: string;
  subtasks: Subtask[];
}

export function SubtaskChecklist({ taskId, projectId, subtasks }: SubtaskChecklistProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
  };

  const suggestMut = useMutation({
    mutationFn: () => aiSubtaskBreakdown({ task_id: taskId }),
    onSuccess: (res) => {
      if (aiUnavailable(res.provider_used)) {
        toast.message("AI is not configured.");
        return;
      }
      setSuggestions(res.subtasks);
      if (res.subtasks.length === 0) toast.message("No suggestions returned.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const addSuggestion = async (text: string) => {
    try {
      await createSubtask(taskId, text);
      setSuggestions((s) => s.filter((x) => x !== text));
      invalidate();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const addAllSuggestions = async () => {
    for (const s of suggestions) {
      try {
        await createSubtask(taskId, s);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
    }
    setSuggestions([]);
    invalidate();
  };

  const toggleMut = useMutation({
    mutationFn: (st: Subtask) => updateSubtask(st.id, { is_done: !st.is_done }),
    onSuccess: invalidate,
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const createMut = useMutation({
    mutationFn: (t: string) => createSubtask(taskId, t),
    onSuccess: () => {
      setTitle("");
      invalidate();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSubtask(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.is_done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subtasks</h3>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {done}/{total} done
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={suggestMut.isPending}
            onClick={() => suggestMut.mutate()}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            {suggestMut.isPending ? "Thinking…" : "Suggest"}
          </Button>
        </div>
      </div>

      {total > 0 && <Progress value={pct} className="h-1.5" />}

      <ul className="space-y-1">
        {subtasks.map((st) => (
          <li
            key={st.id}
            className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60"
          >
            <button
              type="button"
              aria-label={st.is_done ? "Mark incomplete" : "Mark complete"}
              onClick={() => toggleMut.mutate(st)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {st.is_done ? (
                <CheckSquare className="h-4 w-4 text-emerald-600" />
              ) : (
                <Square className="h-4 w-4" />
              )}
            </button>
            <span
              className={cn(
                "flex-1 text-sm",
                st.is_done && "text-muted-foreground line-through",
              )}
            >
              {st.title}
            </span>
            <button
              type="button"
              aria-label="Delete subtask"
              onClick={() => deleteMut.mutate(st.id)}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {suggestions.length > 0 && (
        <div className="space-y-1 rounded-md border border-dashed bg-muted/40 p-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3" /> AI suggestions
            </span>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={addAllSuggestions}
            >
              Add all
            </button>
          </div>
          {suggestions.map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                aria-label="Add subtask"
                onClick={() => addSuggestion(s)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className="flex-1">{s}</span>
              <button
                type="button"
                aria-label="Dismiss suggestion"
                onClick={() => setSuggestions((cur) => cur.filter((x) => x !== s))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = title.trim();
          if (t) createMut.mutate(t);
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a subtask"
          maxLength={200}
          className="h-8"
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          disabled={!title.trim() || createMut.isPending}
          aria-label="Add subtask"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
