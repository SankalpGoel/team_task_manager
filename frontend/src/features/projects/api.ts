import { api } from "@/lib/api";

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends Project {
  task_count: number;
  done_count: number;
  progress: number;
}

export async function listProjects(workspaceId: string): Promise<ProjectWithStats[]> {
  const { data } = await api.get<ProjectWithStats[]>(`/workspaces/${workspaceId}/projects`);
  return data;
}

export async function createProject(
  workspaceId: string,
  payload: { name: string; description?: string },
): Promise<Project> {
  const { data } = await api.post<Project>(`/workspaces/${workspaceId}/projects`, payload);
  return data;
}

export async function getProject(projectId: string): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${projectId}`);
  return data;
}

export async function updateProject(
  projectId: string,
  payload: { name?: string; description?: string },
): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${projectId}`, payload);
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  await api.delete(`/projects/${projectId}`);
}
