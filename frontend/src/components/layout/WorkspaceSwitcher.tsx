import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { createWorkspace } from "@/features/workspace/api";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

export function WorkspaceSwitcher() {
  const memberships = useAuthStore((s) => s.memberships);
  const activeId = useAuthStore((s) => s.activeWorkspaceId);
  const setActive = useAuthStore((s) => s.setActiveWorkspaceId);

  const active = memberships.find((m) => m.workspace.id === activeId) ?? memberships[0];
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const createMut = useMutation({
    mutationFn: (n: string) => createWorkspace(n),
    onSuccess: async (ws) => {
      setShowCreate(false);
      setName("");
      toast.success(`Created “${ws.name}”`);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setActive(ws.id);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (memberships.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">No workspaces</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
          <span className="truncate">{active?.workspace.name ?? "Select workspace"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.workspace.id}
            onClick={() => setActive(m.workspace.id)}
            className="justify-between"
          >
            <span className="truncate">{m.workspace.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{m.role}</span>
            {m.workspace.id === active?.workspace.id && <Check className="ml-2 h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {showCreate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMut.mutate(name.trim());
            }}
            className="space-y-2 p-2"
          >
            <Input
              autoFocus
              placeholder="Workspace name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMut.isPending || !name.trim()}>
                Create
              </Button>
            </div>
          </form>
        ) : (
          <DropdownMenuItem onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New workspace
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
