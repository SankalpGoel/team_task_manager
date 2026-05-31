import { api } from "@/lib/api";
import type { Task } from "@/features/tasks/api";

export interface StatusCounts {
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
}

export interface ProjectProgress {
  id: string;
  name: string;
  total: number;
  done: number;
  progress: number;
}

export interface WorkloadEntry {
  user_id: string;
  full_name: string;
  open_count: number;
}

export interface TrendPoint {
  day: string;
  completed: number;
}

export interface Dashboard {
  status_counts: StatusCounts;
  overdue_count: number;
  overdue: Task[];
  my_open: Task[];
  due_today_count: number;
  due_today: Task[];
  due_this_week_count: number;
  due_this_week: Task[];
  project_progress: ProjectProgress[];
  workload: WorkloadEntry[];
  completion_trend: TrendPoint[];
}

export async function getDashboard(workspaceId: string): Promise<Dashboard> {
  const { data } = await api.get<Dashboard>(`/workspaces/${workspaceId}/dashboard`);
  return data;
}
