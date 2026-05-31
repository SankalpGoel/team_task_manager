import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createLabel, deleteLabel, listLabels } from "@/features/labels/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const PRESETS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

export default function LabelsPage() {
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const role = useAuthStore((s) => s.activeRole());
  const canManage = role === "admin" || role === "manager";
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESETS[5]);

  const labels = useQuery({
    queryKey: ["labels", workspaceId],
    queryFn: () => listLabels(workspaceId as string),
    enabled: !!workspaceId,
  });

  const createMut = useMutation({
    mutationFn: () => createLabel(workspaceId as string, { name: name.trim(), color }),
    onSuccess: () => {
      toast.success("Label created");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["labels", workspaceId] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLabel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["labels", workspaceId] }),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (!workspaceId) {
    return (
      <div className="container py-8">
        <p className="text-sm text-muted-foreground">Select a workspace to manage labels.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Labels</h1>
        <p className="text-sm text-muted-foreground">
          Categorise tasks with colour-coded labels shared across the workspace.
        </p>
      </div>

      {canManage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">New label</CardTitle>
            <CardDescription>Pick a colour and give it a short name.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) createMut.mutate();
              }}
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 space-y-1">
                  <FieldLabel htmlFor="l-name">Name</FieldLabel>
                  <Input
                    id="l-name"
                    value={name}
                    maxLength={40}
                    placeholder="e.g. bug, design, urgent"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="l-color">Colour</FieldLabel>
                  <input
                    id="l-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                </div>
                <Button type="submit" disabled={!name.trim() || createMut.isPending}>
                  Add label
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use colour ${c}`}
                    onClick={() => setColor(c)}
                    className="h-6 w-6 rounded-full ring-offset-background transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: color.toLowerCase() === c ? "2px solid hsl(var(--ring))" : "none",
                      outlineOffset: 2,
                    }}
                  />
                ))}
                <span
                  className="ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: color + "22", color }}
                >
                  <Tag className="h-3 w-3" />
                  {name.trim() || "preview"}
                </span>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All labels{labels.data ? ` (${labels.data.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {labels.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : !labels.data || labels.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labels yet.</p>
          ) : (
            <ul className="space-y-1">
              {labels.data.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
                >
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ backgroundColor: l.color + "22", color: l.color }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.name}
                  </span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${l.name}`}
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate(l.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
