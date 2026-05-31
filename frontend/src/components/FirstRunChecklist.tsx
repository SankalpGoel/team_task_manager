import { Link } from "react-router-dom";
import { Check, Circle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  to: string;
  done: boolean;
  cta: string;
}

interface FirstRunChecklistProps {
  hasProject: boolean;
  hasTask: boolean;
  hasTeammates: boolean;
  canInvite: boolean;
}

export function FirstRunChecklist({
  hasProject,
  hasTask,
  hasTeammates,
  canInvite,
}: FirstRunChecklistProps) {
  const steps: Step[] = [
    { label: "Create your first project", to: "/app/projects", done: hasProject, cta: "Projects" },
    { label: "Add a task to the board", to: "/app/projects", done: hasTask, cta: "Open a board" },
  ];
  if (canInvite) {
    steps.push({
      label: "Invite a teammate",
      to: "/app/members",
      done: hasTeammates,
      cta: "Members",
    });
  }

  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Get started</CardTitle>
        <CardDescription>
          {completed} of {steps.length} done. Finish setting up your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                {s.done ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(s.done && "text-muted-foreground line-through")}>
                  {s.label}
                </span>
              </span>
              {!s.done && (
                <Link
                  to={s.to}
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                >
                  {s.cta} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
