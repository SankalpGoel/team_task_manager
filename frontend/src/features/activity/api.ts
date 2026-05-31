import { api } from "@/lib/api";

export interface ActivityActor {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Activity {
  id: string;
  workspace_id: string;
  actor: ActivityActor | null;
  verb: string;
  target_type: string;
  target_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export async function listActivity(workspaceId: string, limit = 50): Promise<Activity[]> {
  const { data } = await api.get<Activity[]>(`/workspaces/${workspaceId}/activity`, {
    params: { limit },
  });
  return data;
}
