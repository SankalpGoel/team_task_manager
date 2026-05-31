import { api } from "@/lib/api";
import type { TaskPriority, TaskStatus } from "@/types/api";

export interface TaskUserMini {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

export interface TaskLabelMini {
  id: string;
  name: string;
  color: string;
}

export interface TaskSubtaskMini {
  id: string;
  title: string;
  is_done: boolean;
  position: number;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: TaskUserMini | null;
  due_date: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  labels: TaskLabelMini[];
  subtask_total: number;
  subtask_done: number;
  comment_count: number;
}

export interface TaskDetail extends Task {
  subtasks: TaskSubtaskMini[];
}

export interface BoardGroup {
  status: TaskStatus;
  items: Task[];
}

export interface Board {
  columns: BoardGroup[];
}

export async function createTask(
  projectId: string,
  payload: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    due_date?: string | null;
    assignee_id?: string | null;
    label_ids?: string[];
  },
): Promise<Task> {
  const { data } = await api.post<Task>(`/projects/${projectId}/tasks`, payload);
  return data;
}

export async function listTasks(
  projectId: string,
  params: Record<string, unknown> = {},
): Promise<Task[]> {
  const { data } = await api.get<Task[]>(`/projects/${projectId}/tasks`, { params });
  return data;
}

export async function getBoard(projectId: string): Promise<Board> {
  const { data } = await api.get<Board>(`/projects/${projectId}/tasks`, {
    params: { group_by: "status" },
  });
  return data;
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  const { data } = await api.get<TaskDetail>(`/tasks/${taskId}`);
  return data;
}

export async function updateTask(
  taskId: string,
  payload: Partial<{
    title: string;
    description: string | null;
    priority: TaskPriority;
    due_date: string | null;
    status: TaskStatus;
    assignee_id: string | null;
  }>,
): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${taskId}`, payload);
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}

export async function moveTask(
  taskId: string,
  payload: { status: TaskStatus; before_id?: string | null; after_id?: string | null },
): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${taskId}/move`, payload);
  return data;
}

export async function assignTask(taskId: string, assignee_id: string | null): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${taskId}/assign`, { assignee_id });
  return data;
}
