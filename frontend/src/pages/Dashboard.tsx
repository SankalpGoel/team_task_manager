import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Calendar, CheckCircle2, Clock, ListTodo, PlayCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/features/dashboard/api";
import { FirstRunChecklist } from "@/components/FirstRunChecklist";
import { useWorkspaceMembers } from "@/features/workspace/useMembers";
import { useAuthStore } from "@/store/authStore";
import { cn, initials } from "@/lib/utils";
import type { Task } from "@/features/tasks/api";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof ListTodo;
  tone: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <Icon className={cn("h-4 w-4", tone)} />
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <Link
      to={`/app/projects/${task.project_id}/board`}
      className="flex items-center justify-between gap-3 rounded-md p-2 text-sm hover:bg-accent"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{task.title}</p>
        {task.due_date && (
          <p className="text-xs text-muted-foreground">
            Due {format(parseISO(`${task.due_date}T00:00:00`), "MMM d, yyyy")}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {task.priority}
        </Badge>
        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">{initials(task.assignee.full_name)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const active = useAuthStore((s) => s.activeMembership());
  const workspaceId = active?.workspace.id;

  const dash = useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => getDashboard(workspaceId!),
    enabled: !!workspaceId,
  });

  const members = useWorkspaceMembers();
  const canInvite = active?.role === "admin";

  if (!workspaceId || !active) {
    return (
      <div className="container py-8">
        <p className="text-sm text-muted-foreground">
          Create or join a workspace to see your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user ? `, ${user.full_name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          You're in “{active.workspace.name}” as {active.role}.
        </p>
      </div>

      {dash.isLoading || !dash.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <FirstRunChecklist
            hasProject={dash.data.project_progress.length > 0}
            hasTask={
              dash.data.status_counts.todo +
                dash.data.status_counts.in_progress +
                dash.data.status_counts.in_review +
                dash.data.status_counts.done >
              0
            }
            hasTeammates={(members.data?.length ?? 0) > 1}
            canInvite={canInvite}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="To do" value={dash.data.status_counts.todo} icon={ListTodo} tone="text-slate-500" />
            <StatCard label="In progress" value={dash.data.status_counts.in_progress} icon={PlayCircle} tone="text-blue-500" />
            <StatCard label="In review" value={dash.data.status_counts.in_review} icon={Clock} tone="text-amber-500" />
            <StatCard label="Done" value={dash.data.status_counts.done} icon={CheckCircle2} tone="text-emerald-500" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const data = [
                    { name: "To do", value: dash.data.status_counts.todo, fill: "#94a3b8" },
                    { name: "In progress", value: dash.data.status_counts.in_progress, fill: "#3b82f6" },
                    { name: "In review", value: dash.data.status_counts.in_review, fill: "#f59e0b" },
                    { name: "Done", value: dash.data.status_counts.done, fill: "#10b981" },
                  ];
                  const empty = data.every((d) => d.value === 0);
                  return empty ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={data}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {data.map((d) => (
                            <Cell key={d.name} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
                <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" /> To do</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> In progress</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> In review</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Done</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Completed (14 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={dash.data.completion_trend.map((p) => ({
                      day: format(parseISO(`${p.day}T00:00:00`), "MMM d"),
                      completed: p.completed,
                    }))}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#trend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Workload</CardTitle>
                <CardDescription>Open tasks per teammate</CardDescription>
              </CardHeader>
              <CardContent>
                {dash.data.workload.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No assignments yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={dash.data.workload.map((w) => ({
                        name: w.full_name.split(" ")[0],
                        open: w.open_count,
                      }))}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip />
                      <Bar dataKey="open" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Overdue ({dash.data.overdue_count})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {dash.data.overdue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing overdue. Nice.</p>
                ) : (
                  dash.data.overdue.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">My open tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {dash.data.my_open.length === 0 ? (
                  <p className="text-sm text-muted-foreground">You're all clear.</p>
                ) : (
                  dash.data.my_open.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-blue-500" /> Due this week ({dash.data.due_this_week_count})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {dash.data.due_this_week.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks due this week.</p>
                ) : (
                  dash.data.due_this_week.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dash.data.project_progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                ) : (
                  dash.data.project_progress.map((p) => (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <Link to={`/app/projects/${p.id}/board`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {p.done}/{p.total} · {Math.round(p.progress * 100)}%
                        </span>
                      </div>
                      <Progress value={p.progress * 100} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
