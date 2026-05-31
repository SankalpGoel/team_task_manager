import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Folder, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createProject, listProjects } from "@/features/projects/api";
import { getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function ProjectsPage() {
  const role = useAuthStore((s) => s.activeRole());
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const canCreate = role === "admin" || role === "manager";

  const projects = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => listProjects(workspaceId!),
    enabled: !!workspaceId,
  });

  const create = useMutation({
    mutationFn: () => createProject(workspaceId!, { name: name.trim(), description: description.trim() || undefined }),
    onSuccess: async () => {
      toast.success("Project created");
      await queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (!workspaceId) {
    return (
      <div className="container py-8">
        <p className="text-sm text-muted-foreground">Select a workspace to see its projects.</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Group your team's work.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New project
          </Button>
        )}
      </div>

      {projects.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : projects.data && projects.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((p) => (
            <Link key={p.id} to={`/app/projects/${p.id}/board`} className="group block">
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    {p.name}
                  </CardTitle>
                  {p.description && (
                    <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {p.done_count} / {p.task_count} done
                    </span>
                    <span>{Math.round(p.progress * 100)}%</span>
                  </div>
                  <Progress value={p.progress * 100} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              {canCreate
                ? "Create your first project to start tracking work."
                : "Ask an admin or manager to create a project."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Projects organise your team's tasks.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) create.mutate();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || create.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
