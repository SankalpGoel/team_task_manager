import { api } from "@/lib/api";
import type { TaskPriority, TaskStatus } from "@/types/api";

export interface ProjectHit {
  id: string;
  name: string;
  description: string | null;
}

export interface TaskHit {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface SearchResults {
  projects: ProjectHit[];
  tasks: TaskHit[];
}

export async function searchWorkspace(
  workspaceId: string,
  q: string,
): Promise<SearchResults> {
  const { data } = await api.get<SearchResults>(`/workspaces/${workspaceId}/search`, {
    params: { q },
  });
  return data;
}
