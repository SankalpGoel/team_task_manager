import { api } from "@/lib/api";

export interface Label {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export async function listLabels(workspaceId: string): Promise<Label[]> {
  const { data } = await api.get<Label[]>(`/workspaces/${workspaceId}/labels`);
  return data;
}

export async function createLabel(
  workspaceId: string,
  payload: { name: string; color: string },
): Promise<Label> {
  const { data } = await api.post<Label>(`/workspaces/${workspaceId}/labels`, payload);
  return data;
}

export async function deleteLabel(labelId: string): Promise<void> {
  await api.delete(`/labels/${labelId}`);
}

export async function attachLabel(taskId: string, labelId: string): Promise<Label> {
  const { data } = await api.post<Label>(`/tasks/${taskId}/labels/${labelId}`);
  return data;
}

export async function detachLabel(taskId: string, labelId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/labels/${labelId}`);
}
