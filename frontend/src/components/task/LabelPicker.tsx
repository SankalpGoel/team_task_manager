import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { attachLabel, detachLabel, listLabels } from "@/features/labels/api";
import type { TaskLabelMini } from "@/features/tasks/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface LabelPickerProps {
  taskId: string;
  projectId: string;
  attached: TaskLabelMini[];
}

export function LabelPicker({ taskId, projectId, attached }: LabelPickerProps) {
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();

  const labels = useQuery({
    queryKey: ["labels", workspaceId],
    queryFn: () => listLabels(workspaceId as string),
    enabled: !!workspaceId,
  });

  const attachedIds = new Set(attached.map((l) => l.id));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["board", projectId] });
  };

  const toggle = async (labelId: string, isAttached: boolean) => {
    try {
      if (isAttached) await detachLabel(taskId, labelId);
      else await attachLabel(taskId, labelId);
      refresh();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const all = labels.data ?? [];

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">Labels</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {attached.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: l.color + "22", color: l.color }}
          >
            {l.name}
            <button
              type="button"
              aria-label={`Remove ${l.name}`}
              onClick={() => toggle(l.id, true)}
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              <Plus className="mr-1 h-3 w-3" /> Label
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspace labels</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {all.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No labels yet.{" "}
                <Link to="/app/labels" className="text-primary hover:underline">
                  Create some
                </Link>
                .
              </div>
            ) : (
              all.map((l) => {
                const isOn = attachedIds.has(l.id);
                return (
                  <DropdownMenuItem
                    key={l.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      toggle(l.id, isOn);
                    }}
                    className="gap-2"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="flex-1 truncate">{l.name}</span>
                    {isOn && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                );
              })
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/app/labels" className="gap-2 text-muted-foreground">
                <Tag className="h-3.5 w-3.5" /> Manage labels
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
