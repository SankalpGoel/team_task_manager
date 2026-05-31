import { api } from "@/lib/api";
import type {
  InvitationOut,
  InvitationPreview,
  MemberOut,
  Role,
  Workspace,
  WorkspaceWithRole,
} from "@/types/api";

export async function listMyWorkspaces(): Promise<WorkspaceWithRole[]> {
  const { data } = await api.get<WorkspaceWithRole[]>("/workspaces");
  return data;
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const { data } = await api.post<Workspace>("/workspaces", { name });
  return data;
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
  const { data } = await api.patch<Workspace>(`/workspaces/${id}`, { name });
  return data;
}

export async function deleteWorkspace(id: string): Promise<void> {
  await api.delete(`/workspaces/${id}`);
}

export async function listMembers(workspaceId: string): Promise<MemberOut[]> {
  const { data } = await api.get<MemberOut[]>(`/workspaces/${workspaceId}/members`);
  return data;
}

export async function changeMemberRole(
  workspaceId: string,
  userId: string,
  role: Role,
): Promise<MemberOut> {
  const { data } = await api.patch<MemberOut>(
    `/workspaces/${workspaceId}/members/${userId}`,
    { role },
  );
  return data;
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
}

export async function createInvitation(workspaceId: string, email: string, role: Role) {
  const { data } = await api.post<InvitationOut>(
    `/workspaces/${workspaceId}/invitations`,
    { email, role },
  );
  return data;
}

export async function listPendingInvitations(workspaceId: string) {
  const { data } = await api.get<InvitationOut[]>(`/workspaces/${workspaceId}/invitations`);
  return data;
}

export async function revokeInvitation(invitationId: string) {
  await api.delete(`/invitations/${invitationId}`);
}

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const { data } = await api.get<InvitationPreview>(`/invitations/${token}`);
  return data;
}

export async function acceptInvitation(token: string): Promise<InvitationOut> {
  const { data } = await api.post<InvitationOut>(`/invitations/${token}/accept`);
  return data;
}
