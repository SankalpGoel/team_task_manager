import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Activity,
  Folder,
  LayoutDashboard,
  ListTodo,
  Search,
  Tag,
  Users,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { searchWorkspace } from "@/features/search/api";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const NAV_COMMANDS = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard },
  { label: "Projects", to: "/app/projects", icon: Folder },
  { label: "Activity", to: "/app/activity", icon: Activity },
  { label: "Labels", to: "/app/labels", icon: Tag },
  { label: "Members", to: "/app/members", icon: Users },
];

const PRIORITY_TINT: Record<string, string> = {
  low: "text-slate-500",
  medium: "text-blue-500",
  high: "text-amber-500",
  urgent: "text-red-500",
};

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const workspaceId = useAuthStore((s) => s.activeWorkspaceId);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Global Cmd/Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Reset query each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  // Debounce the server search.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery({
    queryKey: ["search", workspaceId, debounced],
    queryFn: () => searchWorkspace(workspaceId as string, debounced),
    enabled: !!workspaceId && debounced.length >= 1 && open,
  });

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const projects = results.data?.projects ?? [];
  const tasks = results.data?.tasks ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search and commands</DialogTitle>
        <Command shouldFilter={false} className="flex flex-col">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search projects and tasks…"
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {debounced.length >= 1 && results.isFetching && (
              <div className="px-2 py-3 text-sm text-muted-foreground">Searching…</div>
            )}

            {debounced.length >= 1 &&
              !results.isFetching &&
              projects.length === 0 &&
              tasks.length === 0 && (
                <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No results for “{debounced}”.
                </Command.Empty>
              )}

            {debounced.length === 0 && (
              <Command.Group
                heading="Go to"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {NAV_COMMANDS.map((c) => (
                  <Command.Item
                    key={c.to}
                    value={`nav ${c.label}`}
                    onSelect={() => go(c.to)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <c.icon className="h-4 w-4 text-muted-foreground" />
                    {c.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {projects.length > 0 && (
              <Command.Group
                heading="Projects"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {projects.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`project ${p.id} ${p.name}`}
                    onSelect={() => go(`/app/projects/${p.id}/board`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{p.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {tasks.length > 0 && (
              <Command.Group
                heading="Tasks"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {tasks.map((t) => (
                  <Command.Item
                    key={t.id}
                    value={`task ${t.id} ${t.title}`}
                    onSelect={() => go(`/app/projects/${t.project_id}/board?task=${t.id}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <ListTodo className={`h-4 w-4 ${PRIORITY_TINT[t.priority] ?? "text-muted-foreground"}`} />
                    <span className="truncate">{t.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {t.status.replace("_", " ")}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
