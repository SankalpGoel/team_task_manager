import { api } from "@/lib/api";

export interface CommentAuthor {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Comment {
  id: string;
  task_id: string;
  parent_id: string | null;
  body: string;
  author: CommentAuthor | null;
  created_at: string;
  updated_at: string;
  mentions: string[];
}

export async function listComments(taskId: string): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(`/tasks/${taskId}/comments`);
  return data;
}

export async function createComment(
  taskId: string,
  payload: { body: string; parent_id?: string | null },
): Promise<Comment> {
  const { data } = await api.post<Comment>(`/tasks/${taskId}/comments`, payload);
  return data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`/comments/${commentId}`);
}
