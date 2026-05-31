import { api } from "@/lib/api";
import type { NotificationType } from "@/types/api";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export async function listNotifications(
  params: { unread?: boolean; limit?: number } = {},
): Promise<Notification[]> {
  const { data } = await api.get<Notification[]>("/notifications", { params });
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
}
