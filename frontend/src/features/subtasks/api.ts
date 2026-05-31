import { api } from "@/lib/api";

export interface Subtask {
  id: string;
  title: string;
  is_done: boolean;
  position: number;
}

export async function createSubtask(taskId: string, title: string): Promise<Subtask> {
  const { data } = await api.post<Subtask>(`/tasks/${taskId}/subtasks`, { title });
  return data;
}

export async function updateSubtask(
  subtaskId: string,
  payload: Partial<{ title: string; is_done: boolean }>,
): Promise<Subtask> {
  const { data } = await api.patch<Subtask>(`/subtasks/${subtaskId}`, payload);
  return data;
}

export async function deleteSubtask(subtaskId: string): Promise<void> {
  await api.delete(`/subtasks/${subtaskId}`);
}
